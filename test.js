// test.js
require('dotenv').config();
const { OpenAI } = require('openai');

console.log('🔑 KEY:', process.env.OPENAI_API_KEY?.slice(0,10) + '…');

(async () => {
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const resp = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: 'Hello, world!' }],
    });
    console.log('✅ SUCCESS:', resp.choices[0].message.content);
  } catch (err) {
    console.error('💥 RAW ERROR:', err);
  }
})();

