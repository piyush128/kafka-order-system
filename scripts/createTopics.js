import kafka from "../shared/config/kafka.js";
import 'dotenv/config';

const admin = kafka.admin();

const topics = [
    'order-created',
    'payment-processed', 
    'inventory-reserved',
    'order-created-dlq'
]

const numPartitions = parseInt(process.env.KAFKA_NUM_PARTITIONS) || 3;

await admin.connect()
console.log('Creating topics...')

const created = await admin.createTopics({
  waitForLeaders: true,
  topics: topics.map(topic => ({
    topic,
    numPartitions,
    replicationFactor: 1
  }))
})

if (created) {
    topics.forEach(topic =>
      console.log(`Created: ${topic} — ${numPartitions} partitions`)
    )
  } else {
    console.log('Topics already exist — skipping creation')
  }

await admin.disconnect()
console.log('Done.')
