import kafka from "../../shared/config/kafka.js";

const payload = {
    orderId: 'ord_001',
    userId: 'usr_42',
    createdAt: new Date().toISOString(),
    totalPrice: 299.99,
    currency: 'USD',
    status: 'created',
    items: [
        {
            itemId: 'item_01',
            quantity: 1,
            price: 299.99,
        }
    ],
}

const producer = kafka.producer();

const sendOrderEvent = async () => {
    await producer.connect();

    await producer.send({
        topic: 'order-created',
        messages: [
            {
                key: payload.orderId,
                value: JSON.stringify(payload)
            }
        ]
    })
    console.log('Order Event sent: ', payload.orderId);

    await producer.disconnect();
}

sendOrderEvent();