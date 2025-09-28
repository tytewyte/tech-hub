exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'GET') return { statusCode: 405, headers, body: JSON.stringify({ message: 'Method not allowed' }) };

  try {
    const flows = [
      {
        id: 'no-heat',
        title: 'No Heat',
        systemTypes: ['Furnace', 'Heat Pump', 'Boiler'],
        steps: [
          'Check thermostat settings',
          'Check circuit breakers',
          'Check fuel supply',
          'Check filter',
          'Check pilot light or ignition (if applicable)'
        ],
        safetyWarnings: [
          'Turn off power before inspecting internal components',
          'Do not attempt to repair gas components',
          'If you smell gas, leave immediately and call your gas company'
        ]
      },
      {
        id: 'no-cooling',
        title: 'No Cooling',
        systemTypes: ['Central AC', 'Heat Pump', 'Mini-Split'],
        steps: [
          'Check thermostat settings',
          'Check circuit breakers',
          'Check outdoor unit power',
          'Check filter',
          'Check for ice on refrigerant lines'
        ],
        safetyWarnings: [
          'Turn off power before inspecting components',
          'Do not attempt to repair refrigerant lines',
          'Keep debris clear from outdoor unit'
        ]
      },
      {
        id: 'poor-airflow',
        title: 'Poor Airflow',
        systemTypes: ['All'],
        steps: [
          'Check and replace air filters',
          'Check for closed or blocked vents',
          'Check for duct obstructions',
          'Inspect blower motor and fan'
        ],
        safetyWarnings: [
          'Turn off system before inspecting internal components',
          'Be cautious of sharp edges in ductwork',
          'Do not remove permanent duct components without professional help'
        ]
      }
    ];

    return { statusCode: 200, headers, body: JSON.stringify({ flows }) };
  } catch (err) {
    console.error('[API_TROUBLESHOOTING_FLOWS]', err);
    return { statusCode: 500, headers, body: JSON.stringify({ message: 'Server error' }) };
  }
};
