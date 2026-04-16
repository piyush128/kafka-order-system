import { Kafka }from 'kafkajs';
import 'dotenv/config'

const kafka = new Kafka({
    clientId: process.env.SERVICE_NAME,
    brokers: ['localhost:9092']
})

export default kafka;