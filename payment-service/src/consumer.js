import kafka from "../../shared/config/kafka.js";
import { retryWithBackoff } from "../../shared/utils/retry.js";
import { redisClient } from "../utils/redis.js";
import { Partitioners } from "kafkajs";

const consumer = kafka.consumer({
    groupId: 'payment-processing'
})

const producer = kafka.producer({
    createPartitioner: Partitioners.LegacyPartitioner
})

const startConsumer = async () => {
    await consumer.connect();
    await producer.connect();

    await consumer.subscribe({
        topic: 'order-created',
        fromBeginning: false
    })

    await consumer.run({
        autoCommit: false,
        eachMessage: async({topic, partition, message}) => {
            const value =  message.value.toString();
            const key = message.key.toString();
            const payload = JSON.parse(value);
            const version = payload.version ?? 1;
            try {
                await retryWithBackoff(async () => {
                    console.log('Order received', payload);
                    const processedId = await redisClient.get(`processed:${payload.orderId}`);
                    if(!processedId){ 
                        if(version > 2){
                            console.warn(`Received unknown version ${version}, processed with known fields`);
                        }
                        const outgoingPayload = {
                            version,
                            orderId: payload.orderId,      // only what YOU know
                            userId: payload.userId,
                            totalPrice: payload.totalPrice,
                            currency: payload.currency,
                            status: 'payment-success',
                            items: payload.items,
                            createdAt: payload.createdAt
                        } 
                        await producer.send({
                            topic: 'payment-processed',
                            messages: [
                                {
                                    key: key,
                                    value: JSON.stringify(outgoingPayload),
                                }
                            ]
                        })
                        console.log('Message processed to inventory service with order id: ', payload.orderId);
                        await redisClient.set(`processed:${payload.orderId}`,'1', 'EX', 86400);
                    }
                    else {
                        console.log('Duplicate detected, skipping:', payload.orderId)
                    }
                }, 3, 500);
                
            } catch (error) {
                const errorData = {
                    ...payload,
                    error: error.message,
                    failedAt: new Date().toISOString(),
                    topic: topic,
                    partition: partition,
                    offset: message.offset
                }
                await producer.send({
                    topic: 'order-created-dlq',
                    messages: [
                        {
                            key: key,
                            value: JSON.stringify(errorData),
                        }
                    ]
                })
                console.log('Message is produced to order-created-dlq due to error: ', error);
            }
            await consumer.commitOffsets([{
                topic,
                partition,
                offset: (Number(message.offset) + 1).toString()
            }])   
        }
    })

}

startConsumer();