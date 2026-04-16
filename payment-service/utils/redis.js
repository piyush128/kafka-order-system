import  { Redis } from 'ioredis';

const redisClient = new Redis();

redisClient.on('connect', () =>{
    console.log('Redis Connected');
})

redisClient.on('error' , (err) => {
    console.error('Error in connecting redis', err);
})


export {redisClient};