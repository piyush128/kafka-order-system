import kafka from "../../shared/config/kafka.js";

const consumer = kafka.consumer({
    groupId: 'notification-service'
})

const startConsumer = async () => {
    await consumer.connect();

    await consumer.subscribe({
        topic: 'inventory-reserved',
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
                console.log(`Notifying user ${payload.userId} — order ${payload.orderId} completed`);
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