const express = require('express');
const router = express.Router();
const axios = require('axios');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const Manual = require('../models/Manual');
const { searchManuals } = require('../utils/manual-search');
const Cache = require('../utils/cache');

// Middleware to verify JWT token
const auth = (req, res, next) => {
  const token = req.header('x-auth-token');
  
  if (!token) {
    return res.status(401).json({ message: 'No token, authorization denied' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded.user;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};

// File upload dependencies
const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, unique + '-' + file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_'));
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Invalid file type'));
  }
});

// List manuals endpoint
router.get('/list-manuals', auth, (req, res) => {
  try {
    const manuals = fs.readdirSync(uploadDir)
      .filter(file => file.toLowerCase().endsWith('.pdf'))
      .map(fileName => {
        const filePath = path.join(uploadDir, fileName);
        const stats = fs.statSync(filePath);
        return {
          filename: fileName,
          size: stats.size,
          uploadDate: stats.mtime.toISOString(),
          title: fileName.replace(/\.[^/.]+$/, "").replace(/-/g, " ")
        };
      });
    res.json(manuals);
  } catch (err) {
    console.error('Error listing manuals:', err);
    res.status(500).json({ message: 'Error listing manuals', error: err.message });
  }
});

// Manual upload endpoint
router.post('/upload-manual', [auth, upload.single('file')], async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }

  try {
    const { title, category, subcategory, description, isPublic } = req.body;

    const newManual = new Manual({
      title,
      category,
      subcategory,
      description,
      fileName: req.file.filename,
      filePath: req.file.path,
      fileType: req.file.mimetype,
      fileSize: req.file.size,
      isPublic: isPublic === 'true',
      uploadedBy: req.user.id,
    });

    const savedManual = await newManual.save();

    res.status(201).json({
      message: 'File uploaded and manual created successfully',
      manual: savedManual,
    });
  } catch (error) {
    console.error('Error creating manual:', error);
    res.status(500).json({ message: 'Server error while creating manual' });
  }
});

// Get all manuals (public or user's own)
router.get('/manuals', auth, async (req, res) => {
  try {
    const cacheKey = `manuals:${req.user.id}`;
    const cachedManuals = await Cache.get(cacheKey);
    
    if (cachedManuals) {
      return res.json(cachedManuals);
    }

    const manuals = await Manual.find({
      $or: [{ isPublic: true }, { uploadedBy: req.user.id }],
    }).populate('uploadedBy', 'username');
    
    // Cache for 5 minutes
    await Cache.set(cacheKey, manuals, 300);
    res.json(manuals);
  } catch (error) {
    console.error('Error fetching manuals:', error);
    res.status(500).json({ message: 'Server error while fetching manuals' });
  }
});

// Delete a manual
router.delete('/manuals/:id', auth, async (req, res) => {
  try {
    const manual = await Manual.findById(req.params.id);

    if (!manual) {
      return res.status(404).json({ message: 'Manual not found' });
    }

    // Check if the user is the owner of the manual
    if (manual.uploadedBy.toString() !== req.user.id) {
      return res.status(401).json({ message: 'User not authorized to delete this manual' });
    }

    // Delete the file from the filesystem
    fs.unlink(manual.filePath, (err) => {
      if (err) {
        console.error('Error deleting manual file:', err);
        // We can choose to continue even if file deletion fails
      }
    });

    await manual.remove();

    res.json({ message: 'Manual deleted successfully' });
  } catch (error) {
    console.error('Error deleting manual:', error);
    res.status(500).json({ message: 'Server error while deleting manual' });
  }
});

// Simple admin check middleware (replace with real role check in production)
function adminOnly(req, res, next) {
  // Example: check for admin flag in JWT payload
  if (req.user && req.user.isAdmin) {
    return next();
  }
  return res.status(403).json({ message: 'Admin access required' });
}

// Simple input sanitization utility
function sanitizeInput(obj) {
  if (typeof obj === 'string') {
    return obj.replace(/[<>"'`;]/g, '');
  } else if (Array.isArray(obj)) {
    return obj.map(sanitizeInput);
  } else if (typeof obj === 'object' && obj !== null) {
    const clean = {};
    for (const k in obj) {
      clean[k] = sanitizeInput(obj[k]);
    }
    return clean;
  }
  return obj;
}

// Enable editing for user 'tytewyte' only
router.post('/edit-knowledge', auth, (req, res) => {
  try {
    // Only allow user 'tytewyte' (from JWT payload)
    if (!req.user || req.user.username !== 'tytewyte') {
      return res.status(403).json({ message: 'Edit access denied' });
    }
    const sanitized = sanitizeInput(req.body);
    const kbPath = path.join(__dirname, '..', 'data', 'hvac-knowledge-base.json');
    let kbRaw = fs.readFileSync(kbPath, 'utf-8');
    let kb = JSON.parse(kbRaw);
    // Accept full replacement or partial update (merge)
    if (sanitized.fullReplace) {
      kb = sanitized.data;
    } else {
      // Merge: shallow merge top-level keys
      for (const k in sanitized.data) {
        kb[k] = sanitized.data[k];
      }
    }
    fs.writeFileSync(kbPath, JSON.stringify(kb, null, 2));
    res.json({ message: 'Knowledge base updated successfully.' });
  } catch (err) {
    res.status(400).json({ message: 'Invalid input', error: err.message });
  }
});

// Get troubleshooting flows from knowledge base
router.get('/troubleshooting-flows', auth, (req, res) => {
  try {
    const kbPath = path.join(__dirname, '..', 'data', 'hvac-knowledge-base.json');
    const kbRaw = fs.readFileSync(kbPath, 'utf-8');
    const kb = JSON.parse(kbRaw);
    const flows = kb.troubleshooting ? Object.values(kb.troubleshooting) : [];
    res.json({ flows });
  } catch (err) {
    console.error('Error loading troubleshooting flows:', err);
    res.status(500).json({ message: 'Error loading troubleshooting flows', error: err.message });
  }
});

// Search knowledge base (categories, procedures, troubleshooting, etc.)
router.get('/search', auth, (req, res) => {
  const q = (req.query.q || '').toLowerCase();
  if (!q) return res.json({ results: [] });
  try {
    const kbPath = path.join(__dirname, '..', 'data', 'hvac-knowledge-base.json');
    const kbRaw = fs.readFileSync(kbPath, 'utf-8');
    const kb = JSON.parse(kbRaw);
    let results = [];
    // Search safety protocols
    if (kb['safety-protocols']) {
      for (const [key, section] of Object.entries(kb['safety-protocols'])) {
        if (
          (section.title && section.title.toLowerCase().includes(q)) ||
          (section.procedures && section.procedures.some(p => p.toLowerCase().includes(q))) ||
          (section.tags && section.tags.some(tag => tag.toLowerCase().includes(q)))
        ) {
          results.push({ type: 'safety', key, ...section });
        }
      }
    }
    // Search troubleshooting flows
    if (kb.troubleshooting) {
      for (const [key, flow] of Object.entries(kb.troubleshooting)) {
        if (
          (flow.title && flow.title.toLowerCase().includes(q)) ||
          (flow.steps && flow.steps.some(s => s.toLowerCase().includes(q))) ||
          (flow.tags && flow.tags.some(tag => tag.toLowerCase().includes(q)))
        ) {
          results.push({ type: 'troubleshooting', key, ...flow });
        }
      }
    }
    res.json({ results });
  } catch (err) {
    console.error('Error searching knowledge base:', err);
    res.status(500).json({ message: 'Error searching knowledge base', error: err.message });
  }
});

// LM Studio API configuration
const LM_STUDIO_API_URL = process.env.LM_STUDIO_API_URL || 'http://localhost:1234/v1';
const LM_STUDIO_MODEL = process.env.LM_STUDIO_MODEL || 'gemma-3-4b';

// HVAC troubleshooting endpoint with Gemma 3 12B via LM Studio
router.post('/troubleshoot', auth, async (req, res) => {
  try {
    const { systemType, issue, symptoms } = req.body;

    // Search for relevant manuals
    const manualResults = await searchManuals(`${systemType} ${issue} ${symptoms.join(' ')}`);
    let manualContext = 'No specific manuals found.';
    if (manualResults.length > 0) {
        manualContext = 'Refer to these manuals for detailed guidance:\n' +
            manualResults.map(r => `- ${r.title} (Relevance: ${r.score}): "${r.snippet}"`).join('\n');
    }

    if (!issue) {
      return res.status(400).json({ message: 'Issue description is required' });
    }

    // Enhanced system prompt for better AI behavior
    const systemPrompt = `You are an expert HVAC diagnostic assistant. Your name is 'Cascade'. Your goal is to guide users through diagnosing and resolving HVAC issues in a safe, clear, and step-by-step manner.

You have access to a library of reference manuals. Here are the most relevant documents for this issue:

${manualContext}

When you reference one of the manuals, mention it by its full title.

Your Persona:
- Professional & Knowledgeable: You are an expert technician.
- Safety-Conscious: Safety is your absolute top priority.
- Clear & Concise: You provide easy-to-understand instructions.
- Helpful: You proactively guide users to additional resources.

Core Instructions:

1. Analyze User Input: Carefully review the user's system type, issue description, and the diagnostic steps they have already taken.

2. Prioritize Safety Above All:
   - If a user's problem involves electrical work (beyond flipping a breaker), refrigerant handling, gas lines, or internal furnace/boiler components, your PRIMARY response must be to strongly advise them to contact a certified HVAC professional.
   - For any DIY steps, include a clear, bolded Safety Warning section.

3. Provide Structured, Formatted Responses:
   - Use markdown for clarity (headings, bold text, lists).
    -   Structure your response with the following sections:
        -   '### Initial Assessment'
        -   '### Likely Cause(s)'
        -   '### Recommended DIY Steps' (if safe)
        -   '### When to Call a Professional'
        -   '### Further Reading'

4. Leverage the Reference Library:
    -   When relevant, direct users to specific guides in the reference library. For example: "For more details on this, you can consult the **Electrical Troubleshooting Guide** in the Reference Library."

**Example Response Structure:**

### Initial Assessment
Based on your report of a ${systemType} that is not cooling and the symptoms you've provided, here is my analysis.

### Likely Cause(s)
*   **Dirty Air Filter:** This is the most common cause of poor cooling and weak airflow.
*   **Blocked Condenser Unit:** The outside unit cannot dissipate heat if it's covered in debris.

### Recommended DIY Steps
**Safety Warning:** Always turn off all power to your HVAC system at the circuit breaker before performing any maintenance.

1.  **Check the Air Filter:** [Provide instructions]
2.  **Inspect the Outdoor Unit:** [Provide instructions]

### When to Call a Professional
If these steps do not resolve the issue, or if you see ice on the refrigerant lines, it's time to call a professional. This could indicate a refrigerant leak, which requires certified technicians to handle.

### Further Reading
For more information on system maintenance, please see the **'Preventive Maintenance Schedules'** guide in the Reference Library.`;

    // Format user query with available information
    let userQuery = `I'm having an issue with my HVAC system: ${issue}`;
    
    if (systemType) {
      userQuery += `\nSystem type: ${systemType}`;
    }
    
    if (symptoms && symptoms.length > 0) {
      userQuery += `\nSymptoms: ${symptoms.join(', ')}`;
    }

    // Prepare the prompt for Gemma 3 12B
    const fullPrompt = `${systemPrompt}\n\nUser: ${userQuery}\n\nAssistant:`;

    // Call LM Studio API (using the OpenAI-compatible endpoint)
    const response = await axios.post(`${LM_STUDIO_API_URL}/chat/completions`, {
      model: process.env.LM_STUDIO_MODEL || 'gemma-3-4b',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userQuery }
      ],
      max_tokens: 1000,
      temperature: 0.7
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Extract the response text
    const aiResponse = response.data.choices[0].message.content;

    // Return the AI response
    res.json({
      response: aiResponse,
      safetyWarning: 'Always prioritize safety. For complex issues, consult a certified HVAC professional.'
    });

    // Asynchronously save to user's history if logged in
    if (req.user) {
      try {
        const user = await User.findById(req.user.id);
        if (user) {
          user.troubleshootingHistory.push({
            issue,
            systemType,
            symptoms,
            aiResponse
          });
          await user.save();
        }
      } catch (historyError) {
        console.error('Failed to save troubleshooting history:', historyError);
      }
    }

  } catch (err) {
    console.error('LM Studio API error:', err);
    res.status(500).json({ 
      message: 'Error processing your request', 
      error: process.env.NODE_ENV === 'development' ? err.message : undefined 
    });
  }
});

// Get HVAC knowledge base categories
router.get('/knowledge', async (req, res) => {
  try {
    const cacheKey = 'kb:categories';
    const cachedCategories = await Cache.get(cacheKey);
    
    if (cachedCategories) {
      return res.json({ categories: cachedCategories });
    }

    const kbPath = path.join(__dirname, '..', 'data', 'hvac-knowledge-base.json');
    const kbRaw = fs.readFileSync(kbPath, 'utf-8');
    const kb = JSON.parse(kbRaw);
    // For now, return the top-level keys as categories
    const categories = Object.keys(kb).map(key => ({
      id: key,
      name: kb[key].title || key,
      icon: kb[key].icon || '',
      procedures: kb[key].procedures || [],
    }));

    // Cache for 1 hour since knowledge base rarely changes
    await Cache.set(cacheKey, categories, 3600);
    res.json({ categories });
  } catch (err) {
    console.error('Error loading knowledge base:', err);
    res.status(500).json({ message: 'Error loading knowledge base', error: err.message });
  }
});

// Get common troubleshooting flows
router.get('/troubleshooting-flows', auth, (req, res) => {
  // This would typically come from a database
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
  
  res.json({ flows });
});

// Get professional HVAC knowledge content
router.get('/professional-knowledge/:category', auth, (req, res) => {
  const { category } = req.params;
  
  // Professional HVAC knowledge content
  const professionalContent = {
    'air-handler-wiring-components': {
      title: 'Air Handler Wiring & Components',
      content: `
        <h3>Air Handler Wiring & Components (Focus: Troubleshooting & Advanced Diagnostics)</h3>
        
        <h4>Typical Circuit Breakdown:</h4>
        <ul>
          <li><strong>Fuses/Circuit Breakers:</strong> Primary protection. Verify proper sizing and condition. Look for signs of overheating or corrosion.</li>
          <li><strong>Control Board (PCB):</strong> The brain. Common issues include capacitor failures, relay malfunctions, input/output errors, and firmware glitches. Use a multimeter to check voltages at the board's terminals against service manuals. Understanding the wiring diagrams is critical.</li>
          <li><strong>Blower Motor Circuit:</strong> Includes motor windings, centrifugal fan power supply (CFPS) or ECM motor driver, thermal overload protection (TOL), and associated capacitors. Measure winding resistance for shorts/opens. Check capacitor capacitance with a meter. Analyze CFPS/ECM drive signals with an oscilloscope if available.</li>
          <li><strong>Heating Element Circuit (if applicable):</strong> Resistance measurements to check element integrity. Verify proper control from the thermostat or zone board.</li>
          <li><strong>Cooling Coil Fan Motor:</strong> Similar circuit considerations as the blower motor.</li>
        </ul>
        
        <h4>Key Components & Troubleshooting Tips:</h4>
        <ul>
          <li><strong>Capacitors:</strong> Dual-run capacitors are common for both motors. Test with a capacitance meter and visually inspect for bulging, leaking, or corrosion. Discharge before handling!</li>
          <li><strong>Relays:</strong> Listen for clicking sounds (or lack thereof). Use a multimeter to check coil continuity and contact closure.</li>
          <li><strong>Sensors:</strong> Air temperature sensors, return air temperature sensors, supply air temperature sensors – all critical for proper operation. Verify signal accuracy with a calibrated thermometer.</li>
          <li><strong>Wiring Connections:</strong> Loose or corroded connections are frequent culprits. Use a thermal imaging camera to identify hotspots indicating resistance.</li>
        </ul>
        
        <div class="safety-notice">
          <i class="fas fa-exclamation-triangle"></i>
          <p><strong>Safety Notice:</strong> This information is for experienced HVAC professionals only. Working with electrical systems can be extremely dangerous. Always follow all applicable safety regulations and manufacturer's instructions.</p>
        </div>
      `
    },
    'condenser-wiring-components': {
      title: 'Condenser Wiring & Components',
      content: `
        <h3>Condenser Wiring & Components (Focus: High-Voltage Systems and Refrigerant Circuit Interaction)</h3>
        
        <h4>Typical Circuit Breakdown:</h4>
        <ul>
          <li><strong>Disconnect Switch:</strong> Always the first step in any condenser troubleshooting procedure. Verify proper operation and secure connections.</li>
          <li><strong>Contactor:</strong> Controls power to the compressor motor. Check coil continuity, contact closure, and for signs of pitting or burning.</li>
          <li><strong>Compressor Motor Circuit:</strong> Includes start capacitor, run capacitor (often combined), start relay, and overload protection. Similar testing procedures as air handler motors apply.</li>
          <li><strong>Fan Motor Circuit:</strong> Similar to the air handler fan motor circuit.</li>
          <li><strong>Refrigerant Pressure Switches:</strong> High-pressure and low-pressure switches protect the compressor. Verify proper operation using manifold gauges and pressure readings.</li>
        </ul>
        
        <h4>Key Components & Troubleshooting Tips:</h4>
        <ul>
          <li><strong>High-Voltage Wiring:</strong> Condensers utilize high voltage for the compressor motor. Extreme caution is required. Use appropriate personal protective equipment (PPE) – insulated gloves, eye protection.</li>
          <li><strong>Compressor Overload Protector:</strong> This device protects the compressor from overheating. Test continuity with an ohmmeter after allowing it to cool down completely.</li>
          <li><strong>Metering Device (TXV or Capillary Tube):</strong> While not directly electrical, proper refrigerant flow is crucial for condenser performance. Monitor suction and discharge pressures to assess its function.</li>
          <li><strong>Condenser Fan Motor Speed:</strong> Many modern condensers use ECM fans with variable speed control. Verify the fan motor is receiving the correct voltage and that the speed sensor is functioning properly.</li>
        </ul>
        
        <div class="safety-notice">
          <i class="fas fa-exclamation-triangle"></i>
          <p><strong>Safety Notice:</strong> This information is for experienced HVAC professionals only. Working with high-voltage electrical systems and refrigerants can be extremely dangerous. Always follow all applicable safety regulations and manufacturer's instructions.</p>
        </div>
      `
    },
    'maintenance-schedules': {
      title: 'Preventive Maintenance Schedules',
      content: `
        <h3>Preventive Maintenance Schedules</h3>
        
        <h4>Residential HVAC Systems (Annual Checklist)</h4>
        <ul>
          <li><strong>Spring/Summer (AC):</strong> Clean condenser coils, check refrigerant levels, inspect electrical connections, clear drain lines, test thermostat.</li>
          <li><strong>Fall/Winter (Heating):</strong> Inspect heat exchanger, clean burners, check gas pressure, test safety controls, inspect flue pipe.</li>
        </ul>

        <h4>Commercial HVAC Systems (Quarterly Checklist)</h4>
        <ul>
          <li><strong>Q1:</strong> Full system diagnostic, check economizer function, inspect belts and pulleys.</li>
          <li><strong>Q2:</strong> Prepare for cooling season, clean cooling towers, verify chiller operation.</li>
          <li><strong>Q3:</strong> Mid-season check, monitor system performance, inspect for refrigerant leaks.</li>
          <li><strong>Q4:</strong> Prepare for heating season, inspect boilers and furnaces, check heat pumps for proper reversal.</li>
        </ul>
        <div class="safety-notice">
          <i class="fas fa-exclamation-triangle"></i>
          <p><strong>Note:</strong> These are general guidelines. Always refer to the manufacturer's specific maintenance recommendations for each piece of equipment.</p>
        </div>
      `
    },
    'troubleshooting-methodology': {
      title: 'Systematic Troubleshooting Methodology',
      content: `
        <h3>Systematic Troubleshooting Methodology</h3>
        
        <ol>
          <li><strong>1. Gather Information:</strong> Interview the client. What are the symptoms? When did the problem start? Has any recent work been done?</li>
          <li><strong>2. Verify the Complaint:</strong> Operate the system to observe the problem firsthand. Don't rely solely on the client's description.</li>
          <li><strong>3. Perform a Visual Inspection:</strong> Look for obvious issues: disconnected wires, leaks, blocked filters, tripped breakers, unusual noises or smells.</li>
          <li><strong>4. Isolate the Problem Domain:</strong> Determine if the issue is electrical, mechanical, or related to airflow/refrigerant. Use your senses and basic tools.</li>
          <li><strong>5. Follow the Sequence of Operation:</strong> For the specific system, trace the operational steps from the thermostat call to the final output (e.g., cooling). Where does the sequence fail?</li>
          <li><strong>6. Test Components:</strong> Once the problem is isolated to a specific circuit or area, test individual components (capacitors, motors, relays, sensors) using a multimeter and other diagnostic tools.</li>
          <li><strong>7. Identify the Root Cause:</strong> Don't just replace a failed part. Why did it fail? A failed capacitor might indicate a failing motor. A tripped breaker could signal a short.</li>
          <li><strong>8. Make the Repair:</strong> Replace the faulty component(s) and address the root cause.</li>
          <li><strong>9. Verify the Repair:</strong> Operate the system through a full cycle to ensure the problem is resolved and no new issues have been introduced.</li>
          <li><strong>10. Document Findings:</strong> Record the complaint, findings, root cause, and repair actions. This is crucial for future service calls.</li>
        </ol>
      `
    },
    'tools-and-equipment': {
      title: 'Essential HVAC Tools & Equipment',
      content: `
        <h3>Essential HVAC Tools & Equipment</h3>

        <h4>Hand Tools:</h4>
        <ul>
          <li>Multipurpose Screwdrivers (11-in-1)</li>
          <li>Pliers (Linesman, Needle-Nose, Channel-Lock)</li>
          <li>Wire Strippers & Crimpers</li>
          <li>Adjustable Wrenches</li>
          <li>Hex Key (Allen Wrench) Set</li>
          <li>Tubing Cutters</li>
        </ul>

        <h4>Diagnostic Tools:</h4>
        <ul>
          <li><strong>Multimeter:</strong> For measuring Volts, Amps, and Ohms. The most critical diagnostic tool.</li>
          <li><strong>Manifold Gauge Set:</strong> For measuring refrigerant pressures.</li>
          <li><strong>Clamp Meter:</strong> For safely measuring current draw on live circuits.</li>
          <li><strong>Digital Thermometer/Psychrometer:</strong> For measuring temperature and humidity.</li>
          <li><strong>Combustion Analyzer:</strong> For testing furnace efficiency and safety.</li>
          <li><strong>Electronic Leak Detector:</strong> For finding refrigerant leaks.</li>
        </ul>

        <h4>Specialty Tools:</h4>
        <ul>
          <li>Refrigerant Recovery Machine</li>
          <li>Vacuum Pump</li>
          <li>Nitrogen Regulator & Tank</li>
          <li>Swaging & Flaring Tool Kit</li>
        </ul>
      `
    },
    'case-studies': {
        title: 'Troubleshooting Case Studies',
        content: `
        <h3>Troubleshooting Case Studies</h3>

        <h4>Case Study 1: Intermittent No-Cool</h4>
        <ul>
            <li><strong>Complaint:</strong> AC stops cooling on very hot afternoons.</li>
            <li><strong>Initial Findings:</strong> System works fine on arrival. Refrigerant pressures and temperatures are normal.</li>
            <li><strong>Diagnosis:</strong> After letting the system run for an hour, the high-side pressure began to climb, and the compressor eventually shut off on thermal overload. The condenser fan motor was intermittently failing when it got hot.</li>
            <li><strong>Solution:</strong> Replaced the condenser fan motor and run capacitor. Verified stable operation under full load.</li>
        </ul>

        <h4>Case Study 2: Furnace Short-Cycling</h4>
        <ul>
            <li><strong>Complaint:</strong> Furnace runs for 5 minutes, shuts off, then restarts a few minutes later.</li>
            <li><strong>Initial Findings:</strong> Extremely dirty and clogged air filter.</li>
            <li><strong>Diagnosis:</strong> The restricted airflow was causing the furnace to overheat and trip the high-limit safety switch.</li>
            <li><strong>Solution:</strong> Replaced the air filter. Educated the homeowner on the importance of regular filter changes. Verified furnace now completes a full heating cycle.</li>
        </ul>
        `
    },
    'advanced-diagnostics': {
      title: 'Advanced Diagnostics & Considerations',
      content: `
        <h3>Advanced Diagnostics & Considerations</h3>
        
        <ul>
          <li><strong>Wiring Diagrams:</strong> Become intimately familiar with wiring diagrams for various HVAC manufacturers (Carrier, Trane, Lennox, etc.).</li>
          <li><strong>Multimeter Proficiency:</strong> Essential for measuring voltages, currents, resistances, and continuity.</li>
          <li><strong>Oscilloscope Use:</strong> Allows you to visualize electrical signals and diagnose complex issues like intermittent faults or signal distortion.</li>
          <li><strong>Refrigerant Leak Detection:</strong> Use electronic leak detectors and bubble solutions to pinpoint refrigerant leaks.</li>
          <li><strong>System Performance Analysis:</strong> Analyze system performance data (temperature differentials, airflow rates, energy consumption) to identify inefficiencies and potential problems.</li>
        </ul>
        
        <div class="safety-notice">
          <i class="fas fa-exclamation-triangle"></i>
          <p><strong>Safety Notice – CRITICAL!</strong> This information is for experienced HVAC professionals only. Working with electrical systems and refrigerants can be extremely dangerous. Always follow all applicable safety regulations and manufacturer's instructions. Never attempt repairs if you are not properly trained and equipped. Improper handling of electricity or refrigerant can result in serious injury, death, or environmental damage. This information does not substitute for professional judgment.</p>
        </div>
      `
    }
  };
  
  // Convert category parameter to match object keys
  const categoryKey = category.toLowerCase().replace(/ /g, '-');
  
  if (professionalContent[categoryKey]) {
    res.json(professionalContent[categoryKey]);
  } else {
    res.status(404).json({ message: 'Category not found' });
  }
});

// Feedback endpoint
router.post('/feedback', (req, res) => {
  try {
    const feedback = req.body;
    feedback.timestamp = new Date().toISOString();
    feedback.ipAddress = req.ip;
    
    // Create feedback directory if it doesn't exist
    const feedbackDir = path.join(__dirname, '..', 'feedback');
    if (!fs.existsSync(feedbackDir)) {
      fs.mkdirSync(feedbackDir, { recursive: true });
    }
    
    // Save feedback to a JSON file
    const filename = `feedback_${Date.now()}.json`;
    const filePath = path.join(feedbackDir, filename);
    
    fs.writeFileSync(filePath, JSON.stringify(feedback, null, 2));
    
    // Log feedback for monitoring
    console.log(`New feedback received: ${feedback.type}`);
    
    res.status(201).json({ message: 'Feedback received. Thank you!' });
  } catch (error) {
    console.error('Error saving feedback:', error);
    res.status(500).json({ message: 'Error saving feedback', error: error.message });
  }
});

module.exports = router;