export async function retryWithBackoff(fn, retries = 3, delay = 500) {
    try {
        await fn();
    } catch (error) {
        if(retries === 0){
            throw error;
        }
        console.log(`Retry attempt ${retries} failed. Waiting ${delay}ms...`)
        const sleep = (ms) => new Promise(resolve => setTimeout(resolve,ms));
        await sleep(delay);
        await retryWithBackoff(fn, retries-1, delay*2);
    }
}