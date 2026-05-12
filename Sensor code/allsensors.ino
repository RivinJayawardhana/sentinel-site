#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>

#include <TinyGPS++.h>
#include <HardwareSerial.h>
#include "MAX30105.h"
#include "heartRate.h"
#include <OneWire.h>
#include <DallasTemperature.h>

/* WIFI */
const char* ssid = "";

const char* password = "";

const char* awsEndpoint = "";
const int awsPort = 8883;

/* SENSOR DEFINITIONS */
#define ONE_WIRE_BUS 5  
#define AIR_PIN 36  

/* DALLAS SETUP */
OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature sensors(&oneWire);



/* GPS */
TinyGPSPlus gps;
HardwareSerial gpsSerial(1);

/* HEART */
MAX30105 particleSensor;
bool heartSensorOK = false;
long lastBeat = 0;
float bpm = 0;

const char* sensorId = "Device_1776850376944";


/* TIMING */
unsigned long lastSend = 0;

/* -------- AMAZON ROOT CA -------- */

const char* root_ca = R"EOF(

)EOF";

/* -------- DEVICE CERTIFICATE -------- */

const char* device_cert = R"KEY(

)KEY";

/* -------- PRIVATE KEY -------- */

const char* private_key = R"KEY(

)KEY";

WiFiClientSecure net;
PubSubClient client(net);

/* MQTT Topic */
const char* topic = "health/sensors";

/* WIFI */
void connectWiFi() {
  Serial.print("Connecting WiFi");
  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\nWiFi Connected");
}

/* TIME */
void syncTime() {
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");

  Serial.print("Syncing time");
  time_t now = time(nullptr);

  while (now < 8 * 3600 * 2) {
    delay(500);
    Serial.print(".");
    now = time(nullptr);
  }

  Serial.println("\nTime synced!");
}

/* AWS */
void connectAWS() {
  while (!client.connected()) {
    Serial.print("Connecting AWS...");

    if (client.connect("ESP32_Device_01")) {
      Serial.println("Connected!");
    } else {
      Serial.print("Failed: ");
      Serial.println(client.state());
      delay(2000);
    }
  }
}

void setup() {
  Serial.begin(115200);

  /* DALLAS INIT */
  sensors.begin();

  /* GPS */
  gpsSerial.begin(9600, SERIAL_8N1, 18, 19);

  /* HEART SENSOR */
  Wire.begin(21, 22);

  Serial.println("Initializing MAX30102...");
  if (!particleSensor.begin(Wire)) {
    Serial.println("❌ MAX30102 NOT FOUND!");
    heartSensorOK = false;
  } else {
    Serial.println("✅ MAX30102 READY");
    particleSensor.setup();
    particleSensor.setPulseAmplitudeRed(0x0A);
    particleSensor.setPulseAmplitudeGreen(0);
    heartSensorOK = true;
  }

  connectWiFi();
  syncTime();

  net.setCACert(root_ca);
  net.setCertificate(device_cert);
  net.setPrivateKey(private_key);

  client.setServer(awsEndpoint, awsPort);
  client.setBufferSize(512);

  connectAWS();
}

void loop() {
  if (!client.connected()) connectAWS();
  client.loop();

  /* ❤️ HEART (FAST LOOP) */
  if (heartSensorOK) {
    long irValue = particleSensor.getIR();

    if (irValue > 50000) {
      if (checkForBeat(irValue)) {
        long now = millis();
        bpm = 60 / ((now - lastBeat) / 1000.0);
        lastBeat = now;
      }
    }
  }

  if (bpm < 40 || bpm > 180) bpm = 0;

  /* SEND EVERY 5 SEC */
  if (millis() - lastSend > 5000) {
    lastSend = millis();

    /* 🌡️ DALLAS TEMP */
    sensors.requestTemperatures();
    float temperature = sensors.getTempCByIndex(0);

    if (temperature == DEVICE_DISCONNECTED_C) {
      temperature = 0;
    }

    int airValue = analogRead(AIR_PIN);

    double lat = 0, lon = 0;
    while (gpsSerial.available()) {
      gps.encode(gpsSerial.read());
      if (gps.location.isUpdated()) {
        lat = gps.location.lat();
        lon = gps.location.lng();
      }
    }

    /* DEBUG */
    Serial.println("------ DATA ------");
    Serial.print("Temp: "); Serial.println(temperature);
    Serial.print("Air : "); Serial.println(airValue);
    Serial.print("BPM : "); Serial.println(bpm);

    /* JSON */
    String payload = "{";
    payload += "\"temperature\":" + String(temperature) + ",";
    payload += "\"air_quality\":" + String(airValue) + ",";
    payload += "\"heart_rate\":" + String(bpm) + ",";
    payload += "\"Sensor_ID\":\"" + String(sensorId) + "\",";
    payload += "\"latitude\":" + String(lat, 6) + ",";
    payload += "\"longitude\":" + String(lon, 6);
    payload += "}";

    Serial.println(payload);

    if (client.publish(topic, payload.c_str())) {
      Serial.println("✅ Publish SUCCESS");
    } else {
      Serial.println("❌ Publish FAILED");
    }
  }
}