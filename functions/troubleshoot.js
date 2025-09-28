const axios = require('axios');

exports.handler = async (event, context) => {
  // Handle CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ message: 'Method not allowed' })
    };
  }

  console.log('Troubleshoot function invoked.');

  try {

    if (!systemType || !issue) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ message: 'Missing system type or issue description.' })
      };
    }

    const systemPrompt = `You are an expert HVAC troubleshooting assistant. Provide a clear, step-by-step guide to troubleshoot the user's issue. Always include safety warnings where appropriate and advise calling a certified HVAC professional for anything involving electrical internals, gas, or refrigerant.`;
    const userPrompt = `System Type: ${systemType}\nIssue: ${issue}\nSymptoms: ${Array.isArray(symptoms) ? symptoms.join(', ') : ''}`;

    console.log('Sending request to OpenAI...');

    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

    if (!apiKey) {
      console.error('OpenAI API key is not configured.');
      throw new Error('AI service is not configured.');
    }

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 800
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('OpenAI response received.');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ response: response.data.choices[0].message.content })
    };
  } catch (error) {
    console.error('[TROUBLESHOOT_ERROR]', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: 'Error getting troubleshooting help.' })
    };
  }
};
