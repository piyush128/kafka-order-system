import kafka from "../../shared/config/kafka.js";
import { randomUUID } from 'crypto';
import { Partitioners } from 'kafkajs';

const orders = Array.from({length: 10}, (element , i) =>({
    version:Math.floor(Math.random() * 3) + 1,
    orderId: randomUUID(),
    userId: `user_${Date.now()}_${i}`,
    createdAt: new Date().toISOString(),
    totalPrice: parseFloat((Math.random() * 1000).toFixed(2)),
    currency: 'USD',
    status: 'created',
    items: [
        {
            itemId: `item_${Math.floor(Math.random() * 100)}`,
            quantity: Math.floor(Math.random() * 10) + 1,
            price: parseFloat((Math.random() * 100).toFixed(2)),
        }
    ],
}))

const producer = kafka.producer({
    createPartitioner: Partitioners.LegacyPartitioner
});

const sendOrderEvent = async () => {
    await producer.connect();

    await producer.send({
        topic: 'order-created',
        messages: orders.map(order => ({
          key: order.orderId,
          value: JSON.stringify(order)
        }))
      })
      
      orders.forEach(order => console.log('Order sent:', order.orderId))      

    await producer.disconnect();
}

sendOrderEvent();