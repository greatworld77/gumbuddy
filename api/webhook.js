// This is the main bot code that runs on Vercel
const fetch = require('node-fetch');

// Your bot's main logic
async function handleWebhook(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).send('Method not allowed');
    }

    const update = req.body;
    
    // Check if message exists and has text
    if (update.message && update.message.text) {
        const chatId = update.message.chat.id;
        const messageText = update.message.text.toLowerCase();
        
        // Handle different commands
        if (messageText === '/start') {
            await sendMessage(chatId, '🎨 Welcome to AI Image Generator Bot!\n\nSend /image followed by your description to generate an image.\n\nExample: /image a beautiful sunset over mountains');
        }
        else if (messageText === '/help') {
            await sendMessage(chatId, '📖 Commands:\n/image [description] - Generate an image\n/help - Show this help\n/about - About this bot');
        }
        else if (messageText === '/about') {
            await sendMessage(chatId, '🤖 This bot uses Novita AI to generate images from text descriptions.\n\nPowered by advanced AI models.');
        }
        else if (messageText.startsWith('/image')) {
            // Extract the prompt (remove '/image ' part)
            const prompt = messageText.replace('/image', '').trim();
            
            if (!prompt) {
                await sendMessage(chatId, '⚠️ Please provide a description!\n\nExample: /image a cute cat wearing a hat');
                return;
            }
            
            // Send "generating" message
            await sendMessage(chatId, '🎨 Generating your image... This may take a few seconds.');
            
            // Generate the image using Novita AI
            const imageUrl = await generateImage(prompt);
            
            if (imageUrl) {
                // Send the generated image
                await sendPhoto(chatId, imageUrl, `🖼️ Here's your image for: "${prompt}"`);
            } else {
                await sendMessage(chatId, '❌ Sorry, failed to generate image. Please try again later.');
            }
        }
        else {
            await sendMessage(chatId, '🤔 Unknown command. Send /help to see available commands.');
        }
    }
    
    res.status(200).send('OK');
}

// Function to generate image using Novita AI
async function generateImage(prompt) {
    const NOVITA_API_KEY = process.env.NOVITA_API_KEY;
    
    // Novita AI API endpoint
    const apiUrl = 'https://api.novita.ai/v3/async/txt2img';
    
    const requestBody = {
        "model_name": "dreamshaper_8_93211.safetensors",
        "prompt": prompt,
        "width": 512,
        "height": 512,
        "num_inference_steps": 20,
        "guidance_scale": 7,
        "num_images": 1
    };
    
    try {
        // First, create the generation task
        const createResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${NOVITA_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });
        
        const createData = await createResponse.json();
        
        if (createData.task_id) {
            // Poll for result (simplified - in production, use webhooks)
            await wait(5000); // Wait 5 seconds
            
            const resultUrl = `https://api.novita.ai/v3/async/task-result/${createData.task_id}`;
            const resultResponse = await fetch(resultUrl, {
                headers: {
                    'Authorization': `Bearer ${NOVITA_API_KEY}`
                }
            });
            
            const resultData = await resultResponse.json();
            
            if (resultData.images && resultData.images[0]) {
                return resultData.images[0]; // Return the image URL
            }
        }
        
        return null;
    } catch (error) {
        console.error('Novita AI Error:', error);
        return null;
    }
}

// Helper function to wait
function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper: Send text message via Telegram
async function sendMessage(chatId, text) {
    const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
    const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
    
    await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            text: text,
            parse_mode: 'HTML'
        })
    });
}

// Helper: Send photo via Telegram
async function sendPhoto(chatId, photoUrl, caption) {
    const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
    const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendPhoto`;
    
    await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            photo: photoUrl,
            caption: caption
        })
    });
}

// Export for Vercel
module.exports = async (req, res) => {
    return handleWebhook(req, res);
};
