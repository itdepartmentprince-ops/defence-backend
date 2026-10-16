const mammoth = require("mammoth");
const cheerio = require("cheerio");

const normalizeHeader = (value) => value
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLocaleLowerCase("en")
  .replace(/[^a-z0-9]/g, "");

const HEADER_ALIASES = {
  englishQuestion: ["questionenglish", "englishquestion", "question"],
  hindiQuestion: ["questionhindi", "hindiquestion"],
  subject: ["subject"],
  category: ["category", "examcategory"],
  optionA: ["optiona", "a"],
  optionB: ["optionb", "b"],
  optionC: ["optionc", "c"],
  optionD: ["optiond", "d"],
  correctOption: ["correctoption", "correctanswer", "answer"],
  explanation: ["explanation"],
  difficulty: ["difficulty"],
};

const REQUIRED_HEADERS = [
  "englishQuestion",
  "category",
  "optionA",
  "optionB",
  "optionC",
  "optionD",
  "correctOption",
  "explanation",
];

const readCell = (cells, indexes, field) => {
  const index = indexes[field];
  return index === undefined ? "" : (cells[index] || "").trim();
};

const parseQuizWordDocument = async (buffer) => {
  let html;
  try {
    ({ value: html } = await mammoth.convertToHtml({ buffer }));
  } catch {
    const error = new Error("Could not read this Word document. Upload a valid .docx file.");
    error.statusCode = 400;
    throw error;
  }

  const $ = cheerio.load(html);
  const questions = [];

  $("table").each((tableIndex, table) => {
    const rows = $(table).find("tr").toArray();
    if (!rows.length) return;

    const headerCells = $(rows[0]).find("th, td").toArray()
      .map((cell) => normalizeHeader($(cell).text()));
    const indexes = {};

    for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
      const index = headerCells.findIndex((header) => aliases.includes(header));
      if (index !== -1) indexes[field] = index;
    }

    if (indexes.englishQuestion === undefined) return;

    const missingHeaders = REQUIRED_HEADERS.filter((field) => indexes[field] === undefined);
    if (missingHeaders.length) {
      questions.push({
        row: null,
        error: `Table ${tableIndex + 1} is missing required columns: ${missingHeaders.join(", ")}.`,
      });
      return;
    }

    for (const [rowIndex, row] of rows.slice(1).entries()) {
      const cells = $(row).find("th, td").toArray().map((cell) => $(cell).text().trim());
      if (!cells.some(Boolean)) continue;

      const correctOption = readCell(cells, indexes, "correctOption").toLocaleUpperCase("en");
      const correctIndex = ["A", "B", "C", "D"].indexOf(correctOption);
      const difficultyText = readCell(cells, indexes, "difficulty");
      const difficulty = difficultyText ? Number(difficultyText) : 1;

      const question = {
        text: {
          en: readCell(cells, indexes, "englishQuestion"),
          hi: readCell(cells, indexes, "hindiQuestion"),
        },
        subject: readCell(cells, indexes, "subject"),
        category: readCell(cells, indexes, "category"),
        options: ["optionA", "optionB", "optionC", "optionD"]
          .map((field) => readCell(cells, indexes, field)),
        correctIndex,
        explanation: readCell(cells, indexes, "explanation"),
        difficulty,
      };

      const errors = [];
      if (question.text.en.length < 5 || question.text.en.length > 1000) errors.push("English question must be 5–1000 characters.");
      if (question.text.hi.length > 1000) errors.push("Hindi question cannot exceed 1000 characters.");
      if (question.category.length < 2 || question.category.length > 80) errors.push("Category must be 2–80 characters.");
      if (question.subject.length > 80) errors.push("Subject cannot exceed 80 characters.");
      if (question.options.some((option) => !option || option.length > 300)) errors.push("All four options are required and must not exceed 300 characters.");
      if (correctIndex === -1) errors.push("Correct option must be A, B, C, or D.");
      if (question.explanation.length < 5 || question.explanation.length > 1200) errors.push("Explanation must be 5–1200 characters.");
      if (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 5) errors.push("Difficulty must be a whole number from 1 to 5.");

      questions.push(errors.length
        ? { row: rowIndex + 2, error: errors.join(" ") }
        : {
          row: rowIndex + 2,
          question: {
            ...question,
            text: question.text.hi
              ? { en: question.text.en, hi: question.text.hi }
              : { en: question.text.en },
            subject: question.subject || question.category,
          },
        });
    }
  });

  if (!questions.length) {
    const error = new Error("No quiz questions found. Use a Word table with one question per row and the required column headings.");
    error.statusCode = 400;
    throw error;
  }

  const errors = questions.filter((entry) => entry.error);
  const validQuestions = questions.filter((entry) => entry.question);
  if (errors.length) {
    const error = new Error(errors.map((entry) => `${entry.row ? `Row ${entry.row}: ` : ""}${entry.error}`).join(" "));
    error.statusCode = 400;
    throw error;
  }
  if (validQuestions.length > 500) {
    const error = new Error("A Word import can contain at most 500 questions at a time.");
    error.statusCode = 400;
    throw error;
  }

  return validQuestions.map((entry) => entry.question);
};

module.exports = parseQuizWordDocument;
