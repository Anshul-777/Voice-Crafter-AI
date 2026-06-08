"""Voice-Crafter Notification Service"""
import logging, smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.config import settings

logger = logging.getLogger(__name__)


async def send_verification_email(email: str, name: str, token: str):
    verify_url = f"https://app.voicecrafter.ai/verify-email?token={token}"
    subject = "Verify your Voice-Crafter account"
    body = f"""
Hi {name},

Welcome to Voice-Crafter! Please verify your email address to activate your account.

Verify Email: {verify_url}

This link expires in 24 hours.

If you didn't create an account, you can safely ignore this email.

— The Voice-Crafter Team
"""
    await _send_email(email, subject, body)


async def send_password_reset_email(email: str, name: str, token: str):
    reset_url = f"https://app.voicecrafter.ai/reset-password?token={token}"
    subject = "Reset your Voice-Crafter password"
    body = f"""
Hi {name},

We received a request to reset your password.

Reset Password: {reset_url}

This link expires in 2 hours. If you didn't request a password reset, ignore this email.

— The Voice-Crafter Team
"""
    await _send_email(email, subject, body)


async def _send_email(to: str, subject: str, body: str):
    if not settings.SMTP_HOST:
        logger.info(f"[EMAIL STUB] To: {to} | Subject: {subject}")
        return
    try:
        msg = MIMEMultipart()
        msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>"
        msg["To"] = to
        msg["Subject"] = subject
        msg.attach(MIMEText(body, "plain"))
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            if settings.SMTP_TLS:
                server.starttls()
            if settings.SMTP_USER:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.SMTP_FROM_EMAIL, to, msg.as_string())
        logger.info(f"Email sent to {to}: {subject}")
    except Exception as e:
        logger.error(f"Email send failed: {e}")
