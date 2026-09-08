/** A worked example that exercises every kind of change the diff can report. */
export const SAMPLE_LEFT = `{
  "service": "checkout-api",
  "version": "2.4.1",
  "replicas": 3,
  "owner": {
    "team": "payments",
    "contact": "payments@example.com"
  },
  "features": {
    "retries": true,
    "cache": {
      "enabled": true,
      "ttlSeconds": 300
    }
  },
  "regions": ["us-east-1", "eu-west-1", "ap-south-1"],
  "limits": {
    "requestsPerMinute": 1200,
    "burst": 200
  },
  "deprecated": false
}`

export const SAMPLE_RIGHT = `{
  "service": "checkout-api",
  "version": "2.5.0",
  "replicas": 5,
  "owner": {
    "team": "payments",
    "contact": "payments@example.com",
    "oncall": "+1-555-0142"
  },
  "features": {
    "retries": true,
    "cache": {
      "enabled": true,
      "ttlSeconds": 900
    },
    "tracing": true
  },
  "regions": ["us-east-1", "eu-central-1", "eu-west-1", "ap-south-1"],
  "limits": {
    "requestsPerMinute": "1200",
    "burst": 200
  }
}`

export const NEW_DOCUMENT = `{

}`
