import mqtt from "mqtt";

let mqttClientInstance = null;

export const getMqttTopicPrefix = () => import.meta.env.VITE_MQTT_TOPIC_PREFIX || "juicebar";

export const getMqttClient = () => {
  const brokerUrl = import.meta.env.VITE_MQTT_BROKER_URL;

  if (!brokerUrl) {
    return null;
  }

  if (mqttClientInstance) {
    return mqttClientInstance;
  }

  mqttClientInstance = mqtt.connect(brokerUrl, {
    username: import.meta.env.VITE_MQTT_USERNAME || undefined,
    password: import.meta.env.VITE_MQTT_PASSWORD || undefined,
    clientId:
      import.meta.env.VITE_MQTT_CLIENT_ID
      || `juice-bar-display-${Math.random().toString(16).slice(2, 10)}`,
    clean: true,
    connectTimeout: 6000,
    reconnectPeriod: 2000,
  });

  return mqttClientInstance;
};
