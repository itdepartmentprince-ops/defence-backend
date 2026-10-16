class ApiError extends Error {
    constructor(statusCode, message, isOperatoinal = true)
    {
        super(message);
        this.statusCode=statusCode
        this.isOperatoinal = isOperatoinal
        

        Error.captureStackTrace(this, this.constructor)
    }
}


module.exports = ApiError;