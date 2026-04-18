# Event-Driven Order Processing System

A production-grade event-driven microservices system built with Apache Kafka and Node.js. Simulates a real-world e-commerce order flow across four independent services communicating entirely through Kafka events.

## Architecture

```
Order Service
     │
     │ produces → [order-created]
     │
     ▼
Payment Service ──── (fail) ──→ [order-created-dlq]
     │
     │ produces → [payment-processed]
     │
     ▼
Inventory Service
     │
     │ produces → [inventory-reserved]
     │
     ▼
Notification Service
```

### Event Flow

| Step | Producer | Topic | Consumer |
|---|---|---|---|
| 1 | Order Service | `order-created` | Payment Service |
| 2 | Payment Service | `payment-processed` | Inventory Service |
| 3 | Inventory Service | `inventory-reserved` | Notification Service |
| - | Payment Service (on failure) | `order-created-dlq` | - |

---

## Tech Stack

- **Node.js** — ES Modules
- **Apache Kafka** — via KafkaJS v2
- **Redis** — idempotency key storage (ioredis)
- **Docker + Docker Compose** — local infrastructure

---

## Project Structure

```
kafka-order-system/
├── docker-compose.yml          # Kafka, Zookeeper, Redis
├── scripts/
│   └── createTopics.js         # Topic setup script (run before starting services)
├── shared/
│   ├── config/
│   │   └── kafka.js            # Shared Kafka client
│   └── utils/
│       └── retry.js            # Exponential backoff retry helper
├── order-service/
│   └── src/producer.js         # Produces order-created events
├── payment-service/
│   ├── src/consumer.js         # Processes payments, produces payment-processed
│   └── utils/redis.js          # Redis client for idempotency
├── inventory-service/
│   └── src/consumer.js         # Reserves inventory, produces inventory-reserved
├── notification-service/
│   └── src/consumer.js         # Sends user notifications (end of chain)
└── KAFKA_COMMANDS.md           # Kafka CLI reference
```

---

## Prerequisites

- Node.js v16+
- Docker and Docker Compose

---

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/piyush128/kafka-order-system.git
cd kafka-order-system
```

### 2. Configure environment variables

Each service needs a `.env` file. Copy from the sample:

```bash
cp .env.sample .env
cp order-service/.env.sample order-service/.env
cp payment-service/.env.sample payment-service/.env
cp inventory-service/.env.sample inventory-service/.env
cp notification-service/.env.sample notification-service/.env
```

Root `.env` variables:

```
SERVICE_NAME=kafka-setup
KAFKA_NUM_PARTITIONS=3
```

### 3. Install dependencies

```bash
# root (shared scripts)
npm install

# each service
cd order-service && npm install
cd ../payment-service && npm install
cd ../inventory-service && npm install
cd ../notification-service && npm install
```

### 4. Start infrastructure

```bash
docker-compose up -d
```

### 5. Create Kafka topics

**Always run this before starting services.**

```bash
npm run setup
```

This creates all topics with the correct partition count. Safe to run multiple times — skips existing topics.

---

## Running the System

Open a terminal for each service:

```bash
# Terminal 1 — Payment Service
cd payment-service && node src/consumer.js

# Terminal 2 — Inventory Service
cd inventory-service && node src/consumer.js

# Terminal 3 — Notification Service
cd notification-service && node src/consumer.js

# Terminal 4 — Send orders
cd order-service && node src/producer.js
```

You should see events flow through all four terminals in sequence.

---

## Event Schema

### `order-created`

```json
{
  "version": 1,
  "orderId": "uuid",
  "userId": "usr_42",
  "createdAt": "2026-04-17T10:00:00.000Z",
  "totalPrice": 299.99,
  "currency": "USD",
  "status": "created",
  "items": [
    {
      "itemId": "item_01",
      "quantity": 2,
      "price": 149.99
    }
  ]
}
```

Status progression across the chain:

```
created → payment-success → inventory-reserved → (notification sent)
created → payment-failed  → (notification sent, inventory skipped)
```

---

## Production Patterns Implemented

### At-Least-Once Delivery
Manual offset commits — offsets are only committed after successful processing and producing the next event.

### Idempotency
Redis stores processed `orderId` keys with 24-hour TTL. Duplicate messages are detected and skipped before processing.

### Dead Letter Queue (DLQ)
Failed messages after 3 retry attempts are sent to `order-created-dlq` with full error context:
```json
{
  "error": "error message",
  "failedAt": "2026-04-17T10:00:00.000Z",
  "topic": "order-created",
  "partition": 0,
  "offset": "5"
}
```

### Retry with Exponential Backoff
3 attempts before DLQ. Delay doubles each retry:
```
Attempt 1 fails → wait 500ms
Attempt 2 fails → wait 1000ms
Attempt 3 fails → wait 2000ms → DLQ
```

### Schema Versioning
Every event carries a `version` field. Consumers build outgoing events explicitly using only known fields — unknown future fields are silently ignored. Unknown versions log a warning but still process.

### Key-Based Partition Routing
`orderId` is used as the Kafka message key. Same order always routes to the same partition, guaranteeing ordered delivery for all events belonging to one order.

---

## Useful Commands

```bash
# Enter Kafka container
docker exec -it kafka bash

# List topics
kafka-topics --bootstrap-server localhost:9092 --list

# Check consumer lag
kafka-consumer-groups --bootstrap-server localhost:9092 \
  --describe --group payment-processing

# Read raw messages
kafka-console-consumer --bootstrap-server localhost:9092 \
  --topic order-created --from-beginning

# Read DLQ
kafka-console-consumer --bootstrap-server localhost:9092 \
  --topic order-created-dlq --from-beginning
```

---

## Kafka Concepts Covered

| Concept | Where |
|---|---|
| Topics & Partitions | All services |
| Consumer Groups | `payment-processing`, `inventory-processing`, `notification-service` |
| Offset Management | Manual commits in all consumers |
| At-Least-Once Delivery | `autoCommit: false` + manual `commitOffsets` |
| Idempotency | Redis in payment-service |
| Dead Letter Queue | `order-created-dlq` |
| Retry + Exponential Backoff | `shared/utils/retry.js` |
| Key-Based Partitioning | `orderId` as message key |
| Schema Evolution | Version field + explicit payload building |
| Consumer Rebalancing | Multiple consumer instances |
| Broker Failure Recovery | KafkaJS auto-reconnect |
