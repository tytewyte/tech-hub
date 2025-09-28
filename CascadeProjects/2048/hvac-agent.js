class HVACDiagnosticAgent {
    constructor() {
        this.currentScreen = 'welcome';
        this.selectedSystem = '';
        this.selectedCategory = '';
        this.currentStep = 0;
        this.diagnosticSteps = [];
        this.userResponses = {};
        this.diagnosis = null;
        
        this.initializeEventListeners();
        this.loadDiagnosticData();
    }

    async fetchWithAuth(url, options = {}) {
        const token = localStorage.getItem('token');
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers,
        };

        if (token) {
            headers['x-auth-token'] = token;
        }

        try {
            const response = await fetch(url, { ...options, headers });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('Fetch error:', error);
            throw error;
        }
    }

    initializeEventListeners() {
        // System selection
        document.querySelectorAll('.system-card').forEach(card => {
            card.addEventListener('click', (e) => {
                this.selectSystem(e.currentTarget.dataset.system);
            });
        });

        // Problem category selection
        document.querySelectorAll('.category-card').forEach(card => {
            card.addEventListener('click', (e) => {
                this.selectCategory(e.currentTarget.dataset.category);
            });
        });

        // Navigation buttons
        document.getElementById('prev-step').addEventListener('click', () => this.previousStep());
        document.getElementById('next-step').addEventListener('click', () => this.nextStep());
        document.getElementById('reset-btn').addEventListener('click', () => this.reset());
        document.getElementById('start-over').addEventListener('click', () => this.reset());
        document.getElementById('print-results').addEventListener('click', () => this.printResults());
        
        // Reference library buttons
        document.getElementById('reference-btn').addEventListener('click', () => this.showReferenceLibrary());
        document.getElementById('close-reference').addEventListener('click', () => this.closeReferenceLibrary());
        document.getElementById('upload-manual').addEventListener('click', () => this.uploadManual());
        
        // Reference links
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('ref-link') || e.target.closest('.ref-link')) {
                e.preventDefault();
                const link = e.target.closest('.ref-link');
                this.openReference(link.dataset.type, link.dataset.system || link.dataset.topic);
            }
        });
        
        // Modal controls
        document.getElementById('close-modal').addEventListener('click', () => this.closeModal());
        document.getElementById('download-reference').addEventListener('click', () => this.downloadReference());
        document.getElementById('print-reference').addEventListener('click', () => this.printReference());
        
        // Close modal when clicking outside
        document.getElementById('reference-modal').addEventListener('click', (e) => {
            if (e.target.id === 'reference-modal') {
                this.closeModal();
            }
        });
    }

    async loadDiagnosticData() {
        try {
            // Fetch troubleshooting flows which contain the diagnostic steps
            const data = await this.fetchWithAuth('/api/troubleshooting-flows');
            this.troubleshootingFlows = data.flows;
        } catch (error) {
            console.error('Failed to load diagnostic data:', error);
            this.troubleshootingFlows = [];
            alert('Could not load diagnostic information from the server. Please try again later.');
        }
    }

    selectSystem(systemType) {
        this.selectedSystem = systemType;
        document.getElementById('selected-system').textContent = this.getSystemDisplayName(systemType);
        this.showScreen('problem');
    }

    selectCategory(category) {
        this.selectedCategory = category;
        document.getElementById('diagnostic-system').textContent = this.getSystemDisplayName(this.selectedSystem);
        document.getElementById('diagnostic-category').textContent = this.getCategoryDisplayName(category);
        
        this.loadDiagnosticSteps();
        this.showScreen('diagnostic');
    }

    loadDiagnosticSteps() {
        if (!this.troubleshootingFlows) {
            alert('Diagnostic flows not loaded. Please try again.');
            return;
        }

        // Find a suitable flow based on category and system type
        // This logic assumes a loose mapping between category (e.g., 'cooling') and flow titles (e.g., 'No Cooling')
        const flow = this.troubleshootingFlows.find(f => 
            f.title.toLowerCase().includes(this.selectedCategory) &&
            (f.systemTypes.includes('All') || f.systemTypes.map(s => s.toLowerCase().replace(' ', '-')).includes(this.selectedSystem))
        );

        if (flow && flow.steps) {
            // The API provides simple string steps. We need to convert them into the object structure the frontend expects.
            this.diagnosticSteps = flow.steps.map((step, index) => ({
                title: `Step ${index + 1}: ${step}`,
                description: `Let's check the ${step.toLowerCase()}.`,
                icon: 'fas fa-search',
                content: {
                    type: 'question',
                    question: `Did you find any issues with the ${step.toLowerCase()}?`,
                    options: [
                        { value: 'yes', text: 'Yes, I see a problem' },
                        { value: 'no', text: 'No, everything looks normal' },
                        { value: 'unsure', text: 'I am not sure' }
                    ]
                }
            }));
            
            // Since the API doesn't provide diagnoses, we'll clear the old ones
            this.diagnoses = {}; 
            this.currentStep = 0;
            this.userResponses = {};
            this.updateDiagnosticStep();
        } else {
            alert(`No specific diagnostic steps found for ${this.getCategoryDisplayName(this.selectedCategory)} on a ${this.getSystemDisplayName(this.selectedSystem)}. AI diagnostics will be used.`);
            // If no predefined flow, we can proceed directly to AI diagnosis
            this.diagnosticSteps = [];
            this.performDiagnosis();
        }
    }

    updateDiagnosticStep() {
        if (this.currentStep >= this.diagnosticSteps.length) {
            this.performDiagnosis();
            return;
        }

        const step = this.diagnosticSteps[this.currentStep];
        const totalSteps = this.diagnosticSteps.length;
        
        // Update progress
        const progress = ((this.currentStep + 1) / totalSteps) * 100;
        document.getElementById('progress-fill').style.width = `${progress}%`;
        document.getElementById('current-step').textContent = this.currentStep + 1;
        document.getElementById('total-steps').textContent = totalSteps;
        
        // Update step content
        document.getElementById('step-icon').className = step.icon;
        document.getElementById('step-title').textContent = step.title;
        document.getElementById('step-description').textContent = step.description;
        
        // Generate step content
        const stepContent = document.getElementById('step-content');
        stepContent.innerHTML = this.generateStepContent(step.content);
        
        // Update navigation buttons
        document.getElementById('prev-step').disabled = this.currentStep === 0;
        document.getElementById('next-step').textContent = 
            this.currentStep === totalSteps - 1 ? 'Complete Diagnosis' : 'Next';
    }

    generateStepContent(content) {
        if (content.type === 'checklist') {
            return `
                <div class="checklist">
                    ${content.items.map((item, index) => `
                        <div class="checklist-item">
                            <input type="checkbox" id="check-${index}" />
                            <label for="check-${index}">${item}</label>
                        </div>
                    `).join('')}
                </div>
            `;
        } else if (content.type === 'question') {
            return `
                <div class="question">
                    <h4>${content.question}</h4>
                    <div class="question-options">
                        ${content.options.map(option => `
                            <button class="option-button" data-value="${option.value}">
                                ${option.text}
                            </button>
                        `).join('')}
                    </div>
                </div>
            `;
        }
        return '';
    }

    nextStep() {
        // Collect responses from current step
        this.collectStepResponse();
        
        this.currentStep++;
        this.updateDiagnosticStep();
    }

    previousStep() {
        if (this.currentStep > 0) {
            this.currentStep--;
            this.updateDiagnosticStep();
        }
    }

    collectStepResponse() {
        const stepContent = document.getElementById('step-content');
        const step = this.diagnosticSteps[this.currentStep];
        
        if (step.content.type === 'question') {
            const selectedOption = stepContent.querySelector('.option-button.selected');
            if (selectedOption) {
                this.userResponses[step.content.question.toLowerCase().replace(/\s+/g, '-')] = selectedOption.dataset.value;
            }
        } else if (step.content.type === 'checklist') {
            const checkedItems = Array.from(stepContent.querySelectorAll('input[type="checkbox"]:checked'));
            this.userResponses[`step-${this.currentStep}-checklist`] = checkedItems.map(item => item.id);
        }
    }

    async performDiagnosis() {
        this.showScreen('results');
        const issueCard = document.getElementById('diagnosed-issue');
        issueCard.innerHTML = `
            <div class="loading-diagnosis">
                <i class="fas fa-spinner fa-spin"></i>
                <h4>Analyzing your issue...</h4>
                <p>Our AI is processing the information to provide a diagnosis.</p>
            </div>
        `;

        const issueDescription = `The user is experiencing a problem with ${this.selectedCategory} in their ${this.getSystemDisplayName(this.selectedSystem)}.`;
        const symptoms = Object.entries(this.userResponses).map(([key, value]) => {
            const step = this.diagnosticSteps.find(s => s.content.question.toLowerCase().replace(/\s+/g, '-') === key);
            const question = step ? step.content.question : key.replace(/-/g, ' ');
            return `${question}: ${value}`;
        });

        try {
            const data = await this.fetchWithAuth('/api/troubleshoot', {
                method: 'POST',
                body: JSON.stringify({
                    issue: issueDescription,
                    systemType: this.getSystemDisplayName(this.selectedSystem),
                    symptoms: symptoms,
                }),
            });

            this.diagnosis = {
                title: 'AI-Powered Diagnosis',
                description: data.response, // The AI response is a string of text
                steps: [], // Steps are now part of the AI response
                safetyWarning: data.safetyWarning
            };

            this.showResults();
        } catch (error) {
            console.error('AI diagnosis failed:', error);
            this.diagnosis = {
                title: 'Diagnosis Failed',
                description: 'We could not get a diagnosis from our AI assistant at this time. Please check your connection or try again later.',
                steps: ['You can also try our reference library for manual troubleshooting guides.'],
                safetyWarning: 'Always prioritize safety. If you are unsure, please contact a certified HVAC professional.'
            };
            this.showResults();
        }
    }

    showResults() {
        const issueCard = document.getElementById('diagnosed-issue');
        const stepsList = document.getElementById('repair-steps-list');
        const safetyWarning = document.querySelector('.safety-warning p');

        if (!this.diagnosis) return;

        issueCard.innerHTML = `
            <h4>${this.diagnosis.title}</h4>
            <div class="ai-response">${this.diagnosis.description.replace(/\n/g, '<br>') || 'No description available.'}</div>
        `;

        if (this.diagnosis.steps && this.diagnosis.steps.length > 0) {
            stepsList.innerHTML = `
                <ol>
                    ${this.diagnosis.steps.map(step => `<li>${step}</li>`).join('')}
                </ol>
            `;
        } else {
            // If steps are part of the main AI response, clear this section
            stepsList.innerHTML = '';
        }

        if (this.diagnosis.safetyWarning && safetyWarning) {
            safetyWarning.innerHTML = `<strong>Safety First:</strong> ${this.diagnosis.safetyWarning}`;
        }

        this.showScreen('results');
    }

    showScreen(screenName) {
        // Hide all screens
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        
        // Show target screen
        document.getElementById(`${screenName}-screen`).classList.add('active');
        this.currentScreen = screenName;
    }

    reset() {
        this.currentScreen = 'welcome';
        this.selectedSystem = '';
        this.selectedCategory = '';
        this.currentStep = 0;
        this.userResponses = {};
        this.diagnosis = null;
        this.showScreen('welcome');
    }

    printResults() {
        window.print();
    }

    getSystemDisplayName(systemType) {
        const names = {
            'central-air': 'Central Air Conditioning',
            'heat-pump': 'Heat Pump',
            'furnace': 'Furnace',
            'boiler': 'Boiler',
            'window-unit': 'Window Unit',
            'mini-split': 'Mini Split System'
        };
        return names[systemType] || systemType;
    }

    getCategoryDisplayName(category) {
        const names = {
            'cooling': 'Cooling Issues',
            'heating': 'Heating Issues',
            'airflow': 'Airflow Problems',
            'electrical': 'Electrical Issues'
        };
        return names[category] || category;
    }
    
    // Reference Library Methods
    showReferenceLibrary() {
        this.showScreen('reference-screen');
    }
    
    closeReferenceLibrary() {
        // Return to the previous screen
        if (this.currentStep > 0) {
            this.showScreen('diagnostic-screen');
        } else if (this.selectedCategory) {
            this.showScreen('problem-screen');
        } else {
            this.showScreen('welcome-screen');
        }
    }
    
    async openReference(type, identifier) {
        const modal = document.getElementById('reference-modal');
        const title = document.getElementById('modal-title');
        const body = document.getElementById('modal-body');

        body.innerHTML = `<div class="loading-diagnosis"><i class="fas fa-spinner fa-spin"></i><h4>Loading Content...</h4></div>`;
        modal.style.display = 'block';

        let content = '';
        let titleText = '';

        try {
            if (type === 'guide') {
                const guideContent = await this.getGuideContent(identifier);
                titleText = guideContent.title;
                content = guideContent.content;
            } else if (type === 'manual') {
                titleText = `${this.getSystemDisplayName(identifier)} Manual`;
                content = this.getManualContent(identifier);
            } else if (type === 'wiring') {
                titleText = `${this.getSystemDisplayName(identifier)} Wiring Diagrams`;
                content = this.getWiringContent(identifier);
            }

            title.textContent = titleText;
            body.innerHTML = content;
        } catch (error) {
            title.textContent = 'Error';
            body.innerHTML = '<p>Could not load reference content. Please try again later.</p>';
            console.error('Failed to open reference:', error);
        }
    }
    
    async getGuideContent(topic) {
        const topicMap = {
            'electrical': 'air-handler-wiring-components',
            'refrigeration': 'condenser-wiring-components',
            'repair': 'advanced-diagnostics',
            'safety': 'general-safety',
            'maintenance': 'maintenance-schedules',
            'troubleshooting': 'troubleshooting-methodology',
            'tools': 'tools-and-equipment',
            'case-studies': 'case-studies'
        };
        const category = topicMap[topic] || topic;

        try {
            // The 'safety' guide is extensive on the client-side knowledgebase, let's fetch from there if needed
            if (category === 'general-safety') {
                const safetyData = window.HVACKnowledgeBase?.['safety-protocols'];
                if(safetyData) {
                    return { title: 'Safety Protocols', content: this.formatKnowledgeContent(safetyData) };
                }
            }
            
            const data = await this.fetchWithAuth(`/api/professional-knowledge/${category}`);
            return { title: data.title, content: data.content };
        } catch (error) {
            console.error(`Failed to fetch guide for ${topic}:`, error);
            return { title: 'Content Not Found', content: '<p>This content is not available at the moment. Please try again later.</p>' };
        }
    }
    
    formatKnowledgeContent(knowledgeSection) {
        if (!knowledgeSection) return '<p>Content not available.</p>';
        
        let html = '';
        
        if (knowledgeSection.overview) {
            html += `<div class="guide-section"><h3>Overview</h3><p>${knowledgeSection.overview}</p></div>`;
        }
        
        Object.keys(knowledgeSection).forEach(key => {
            if (key !== 'overview' && typeof knowledgeSection[key] === 'object') {
                html += `<div class="guide-section"><h3>${this.formatSectionTitle(key)}</h3>`;
                
                if (Array.isArray(knowledgeSection[key])) {
                    html += '<ul>';
                    knowledgeSection[key].forEach(item => {
                        if (typeof item === 'string') {
                            html += `<li>${item}</li>`;
                        } else if (typeof item === 'object') {
                            html += `<li><strong>${item.title || item.name}:</strong> ${item.description || item.procedure || item.content}</li>`;
                        }
                    });
                    html += '</ul>';
                } else {
                    Object.keys(knowledgeSection[key]).forEach(subKey => {
                        const subSection = knowledgeSection[key][subKey];
                        html += `<h4>${this.formatSectionTitle(subKey)}</h4>`;
                        
                        if (Array.isArray(subSection)) {
                            html += '<ul>';
                            subSection.forEach(item => {
                                html += `<li>${typeof item === 'string' ? item : item.description || item.procedure || item.content}</li>`;
                            });
                            html += '</ul>';
                        } else if (typeof subSection === 'string') {
                            html += `<p>${subSection}</p>`;
                        }
                    });
                }
                
                html += '</div>';
            }
        });
        
        return html || '<p>Content not available.</p>';
    }
    
    formatSectionTitle(key) {
        return key.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    }
    
    getManualContent(system) {
        return `
            <div class="manual-content">
                <h3>${this.getSystemDisplayName(system)} Service Manual</h3>
                <p><strong>Note:</strong> This is a placeholder for actual equipment manuals. In a production environment, this would link to or display actual manufacturer documentation.</p>
                
                <h4>Quick Reference</h4>
                <ul>
                    <li>Installation specifications</li>
                    <li>Electrical requirements</li>
                    <li>Maintenance schedules</li>
                    <li>Troubleshooting charts</li>
                    <li>Parts diagrams</li>
                    <li>Warranty information</li>
                </ul>
                
                <div class="manual-placeholder">
                    <i class="fas fa-file-pdf" style="font-size: 48px; color: #ccc; margin: 20px;"></i>
                    <p>Manual content would be displayed here</p>
                </div>
            </div>
        `;
    }
    
    getWiringContent(system) {
        return `
            <div class="wiring-content">
                <h3>${this.getSystemDisplayName(system)} Wiring Diagrams</h3>
                <p><strong>Note:</strong> This is a placeholder for actual wiring diagrams. In a production environment, this would display interactive wiring diagrams.</p>
                
                <h4>Available Diagrams</h4>
                <ul>
                    <li>Control circuit wiring</li>
                    <li>Power circuit connections</li>
                    <li>Thermostat wiring</li>
                    <li>Safety device connections</li>
                    <li>Component locations</li>
                </ul>
                
                <div class="wiring-placeholder">
                    <i class="fas fa-sitemap" style="font-size: 48px; color: #ccc; margin: 20px;"></i>
                    <p>Wiring diagrams would be displayed here</p>
                </div>
            </div>
        `;
    }
    
    uploadManual() {
        // Create file input for manual upload
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.pdf,.doc,.docx,.txt';
        input.multiple = true;
        
        input.onchange = (e) => {
            const files = Array.from(e.target.files);
            if (files.length > 0) {
                alert(`Selected ${files.length} file(s) for upload. In a production environment, these would be processed and added to the reference library.`);
                // In production, you would handle file upload here
            }
        };
        
        input.click();
    }
    
    closeModal() {
        document.getElementById('reference-modal').style.display = 'none';
    }
    
    downloadReference() {
        const title = document.getElementById('modal-title').textContent;
        const content = document.getElementById('modal-body').innerHTML;
        
        // Create a simple text version for download
        const textContent = content.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
        const blob = new Blob([`${title}\n\n${textContent}`], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.txt`;
        a.click();
        
        URL.revokeObjectURL(url);
    }
    
    printReference() {
        const title = document.getElementById('modal-title').textContent;
        const content = document.getElementById('modal-body').innerHTML;
        
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
                <head>
                    <title>${title}</title>
                    <style>
                        body { font-family: Arial, sans-serif; margin: 20px; }
                        h3, h4 { color: #333; }
                        .guide-section { margin-bottom: 20px; }
                        ul { margin-left: 20px; }
                    </style>
                </head>
                <body>
                    <h1>${title}</h1>
                    ${content}
                </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.print();
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    const app = new HVACDiagnosticAgent();
    
    // Add click handlers for option buttons
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('option-button')) {
            // Remove selection from siblings
            e.target.parentNode.querySelectorAll('.option-button').forEach(btn => {
                btn.classList.remove('selected');
            });
            // Select clicked option
            e.target.classList.add('selected');
        }
    });
});
