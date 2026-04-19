const mqtt = require("mqtt");

let mqttClient = null;
let mqttConnected = false;

const getTopicPrefix = () => String(process.env.MQTT_TOPIC_PREFIX || "juicebar").replace(/\/+$/, "");

const initMqtt = () => {
  const brokerUrl = String(process.env.MQTT_BROKER_URL || "").trim();

  if (!brokerUrl) {
    return null;
  }

  if (mqttClient) {
    return mqttClient;
  }

  mqttClient = mqtt.connect(brokerUrl, {
    username: process.env.MQTT_USERNAME || undefined,
    password: process.env.MQTT_PASSWORD || undefined,
    clientId: process.env.MQTT_CLIENT_ID || `juice-bar-server-${Math.random().toString(16).slice(2, 10)}`,
    clean: true,
    connectTimeout: 6000,
    reconnectPeriod: 2000,
  });

  mqttClient.on("connect", () => {
    mqttConnected = true;
    console.log("MQTT connected");
  });

  mqttClient.on("close", () => {
    mqttConnected = false;
  });

  mqttClient.on("error", (error) => {
    mqttConnected = false;
    console.error("MQTT error:", error.message);
  });

  return mqttClient;
};

const publishPayload = (topic, payload) => new Promise((resolve) => {
  if (!mqttClient || !mqttConnected) {
    resolve(false);
    return;
  }

  mqttClient.publish(
    topic,
    JSON.stringify(payload),
    { qos: 1, retain: false },
    (error) => {
      if (error) {
        console.error("MQTT publish failed:", error.message);
        resolve(false);
        return;
      }

      resolve(true);
    }
  );
});

const publishOrderStatus = async (order) => {
  if (!order || !order.token_number) {
    return false;
  }

  const topicPrefix = getTopicPrefix();
  const status = String(order.status || "UNKNOWN").toLowerCase();

  const payload = {
    id: order.id,
    token_number: order.token_number,
    status: order.status,
    created_at: order.created_at,
    ready_at: order.ready_at,
    completed_at: order.completed_at,
    cancelled_at: order.cancelled_at,
    published_at: new Date().toISOString(),
  };

  const [allTopicSent, statusTopicSent] = await Promise.all([
    publishPayload(`${topicPrefix}/orders/all`, payload),
    publishPayload(`${topicPrefix}/orders/${status}`, payload),
  ]);

  return allTopicSent || statusTopicSent;
};

module.exports = {
  initMqtt,
  publishOrderStatus,
};
