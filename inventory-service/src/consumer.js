import kafka from "../../shared/config/kafka.js";

const consumer = kafka.consumer({
    groupId: 'inventory-processing'
})
const producer = kafka.producer();

const startConsumer = async () => {
    await consumer.connect();
    await producer.connect();

    await consumer.subscribe({
        topic: 'payment-processed',
        fromBeginning: false
    })

    await consumer.run({
        autoCommit: false,
        eachMessage: async({topic, partition, message}) =>{
            const value = message.value.toString();
            const key = message.key.toString();
            const payload = JSON.parse(value);

            if(payload.status ===  'payment-failed'){
                console.log('Payment Failed for the user: ', payload.userId);
            }
            else {
                console.log('Payment received', payload);
                payload.status = 'inventory-reserved';
            }

            await producer.send({
                topic: 'inventory-reserved',
                messages: [
                    {
                        key: key,
                        value: JSON.stringify(payload),
                    }
                ]
            })
            console.log('Message processed to Notification service with order id: ', payload.orderId);

            await consumer.commitOffsets([{
                topic,
                partition,
                offset: (Number(message.offset) + 1).toString()
            }])
        }
    })
}

startConsumer();