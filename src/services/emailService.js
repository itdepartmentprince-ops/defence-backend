const resend = require("../config/resend");

const sendPasswordResetOtp = async (
    email,
    otp
) => {
    const { data, error } =
        await resend.emails.send({
            from: process.env.RESEND_FROM_EMAIL,
            to: email,
            subject: "Password Reset OTP",
            html: `
                <div>
                    <h2>Password Reset</h2>

                    <p>
                        Your password reset verification code is:
                    </p>

                    <h1>${otp}</h1>

                    <p>
                        This code will expire in 5 minutes.
                    </p>

                    <p>
                        If you did not request this,
                        please ignore this email.
                    </p>
                </div>
            `,
        });

    if (error) {
        throw new Error(
            "Failed to send password reset email"
        );
    }

    return data;
};

module.exports = {
    sendPasswordResetOtp,
};