const pool = require("../config/db");
const twilio = require("twilio");

const twilioEnabled =
  Boolean(process.env.TWILIO_ACCOUNT_SID)
  && Boolean(process.env.TWILIO_AUTH_TOKEN);

const twilioClient = twilioEnabled
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;

const logNotification = async ({ orderId, channel, recipient, message, status }) => {
  await pool.query(
    `INSERT INTO notification_logs (order_id, channel, recipient, message, status)
     VALUES ($1, $2, $3, $4, $5)`,
    [orderId || null, channel, recipient || null, message, status]
  );
};

const sendReadyNotification = async ({ orderId, phone, email, tokenNumber }) => {
  const msg = `Order ${tokenNumber} is ready for pickup.`;

  if (phone && twilioClient) {
    if (process.env.TWILIO_SMS_FROM) {
      try {
        await twilioClient.messages.create({
          body: msg,
          from: process.env.TWILIO_SMS_FROM,
          to: phone,
        });

        await logNotification({
          orderId,
          channel: "sms",
          recipient: phone,
          message: msg,
          status: "sent",
        });
      } catch (error) {
        await logNotification({
          orderId,
          channel: "sms",
          recipient: phone,
          message: msg,
          status: `failed:${error.message}`,
        });
      }
    }

    if (process.env.TWILIO_WHATSAPP_FROM) {
      try {
        await twilioClient.messages.create({
          body: msg,
          from: `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}`,
          to: `whatsapp:${phone}`,
        });

        await logNotification({
          orderId,
          channel: "whatsapp",
          recipient: phone,
          message: msg,
          status: "sent",
        });
      } catch (error) {
        await logNotification({
          orderId,
          channel: "whatsapp",
          recipient: phone,
          message: msg,
          status: `failed:${error.message}`,
        });
      }
    }
  } else if (phone) {
    await logNotification({
      orderId,
      channel: "phone",
      recipient: phone,
      message: msg,
      status: "provider_not_configured",
    });
  }

  if (email) {
    await logNotification({
      orderId,
      channel: "email",
      recipient: email,
      message: msg,
      status: "queued",
    });
  }
};

module.exports = {
  sendReadyNotification,
};
