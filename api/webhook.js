// api/webhook.js - WORKING VERSION
const fetch = require('node-fetch');

async function handleWebhook(req, res) {
    if (req.method !== 'POST') {
        return res.status(200).send('OK');
    }

    const update = req.body;
    
    if (update.message && update.message.text) {
        const chatId = update.message.chat.id;
        const messageText = update.message.text.toLowerCase();
        
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
            const prompt = messageText.replace('/image', '').trim();
            
            if (!prompt) {
                await sendMessage(chatId, '⚠️ Please provide a description!\n\nExample: /image a cute cat wearing a hat');
                return;
            }
            
            await sendMessage(chatId, '🎨 Generating your image... This may take 10-15 seconds.');
            
            // Try to generate image
            const imageUrl = await generateImageWithNovita(prompt);
            
            if (imageUrl) {
                await sendPhoto(chatId, imageUrl, `🖼️ Here's your image for: "${prompt}"`);
            } else {
                await sendMessage(chatId, '❌ Failed to generate image.\n\nPossible issues:\n• Invalid API key\n• Account needs payment balance\n• Try a different prompt\n\nSend /help for commands');
            }
        }
        else {
            await sendMessage(chatId, '🤔 Unknown command. Send /help to see available commands.');
        }
    }
    
    res.status(200).send('OK');
}

// UPDATED: Correct Novita AI API implementation
async function generateImageWithNovita(prompt) {
    const NOVITA_API_KEY = process.env.NOVITA_API_KEY;
    
    // Check if API key exists
    if (!NOVITA_API_KEY) {
        console.error('NOVITA_API_KEY is not set in environment variables');
        return null;
    }
    
    // Using the correct async API endpoint [citation:1]
    const apiUrl = 'https://api.novita.ai/v3/async/txt2img';
    
    const requestBody = {
        "extra": {
            "response_image_type": "jpeg"
        },
        "request": {
            "model_name": "sd_xl_base_1.0.safetensors",
            "prompt": prompt,
            "negative_prompt": "nsfw, ugly, bad face, blurry",
            "width": 1024,
            "height": 1024,
            "image_num": 1,
            "steps": 20,
            "seed": -1,
            "clip_skip": 1,
            "sampler_name": "Euler a",
            "guidance_scale": 7.5
        }
    };
    
    try {
        console.log('Sending request to Novita AI...');
        
        // Step 1: Create the task [citation:1]
        const createResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${NOVITA_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });
        
        const createData = await createResponse.json();
        console.log('Create response:', JSON.stringify(createData));
        
        // Check for errors [citation:8]
        if (!createResponse.ok) {
            console.error('API Error:', createData);
            
            if (createResponse.status === 401) {
                console.error('Invalid API Key - check your NOVITA_API_KEY');
            } else if (createResponse.status === 403) {
                console.error('Access denied - account may need verification');
            } else if (createResponse.status === 429) {
                console.error('Rate limit exceeded');
            }
            return null;
        }
        
        const taskId = createData.task_id;
        if (!taskId) {
            console.error('No task_id received');
            return null;
        }
        
        console.log(`Task created: ${taskId}`);
        
        // Step 2: Poll for results (with timeout)
        const maxAttempts = 30; // 30 seconds max
        for (let i = 0; i < maxAttempts; i++) {
            await wait(2000); // Wait 2 seconds between checks
            
            const resultResponse = await fetch(
                `https://api.novita.ai/v3/async/task-result?task_id=${taskId}`,
                {
                    headers: {
                        'Authorization': `Bearer ${NOVITA_API_KEY}`
                    }
                }
            );
            
            const resultData = await resultResponse.json();
            console.log(`Poll attempt ${i + 1}: ${resultData.task?.status}`);
            
            // Check if task succeeded [citation:1]
            if (resultData.task?.status === 'TASK_STATUS_SUCCEED') {
                if (resultData.images && resultData.images.length > 0) {
                    console.log('Image generated successfully!');
                    return resultData.images[0].image_url;
                }
            }
            
            // Check if task failed
            if (resultData.task?.status === 'TASK_STATUS_FAILED') {
                console.error('Task failed:', resultData.task?.reason);
                return null;
            }
        }
        
        console.error('Timeout waiting for image generation');
        return null;
        
    } catch (error) {
        console.error('Novita AI Error:', error.message);
        return null;
    }
}

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function sendMessage(chatId, text) {
    const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
    const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
    
    try {
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: text
            })
        });
    } catch (error) {
        console.error('Send message error:', error);
    }
}

async function sendPhoto(chatId, photoUrl, caption) {
    const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
    const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendPhoto`;
    
    try {
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                photo: photoUrl,
                caption: caption
            })
        });
    } catch (error) {
        console.error('Send photo error:', error);
    }
}

module.exports = async (req, res) => {
    return handleWebhook(req, res);
};
