const express = require('express');
const { chromium } = require('playwright');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const app = express();
const PORT = 3000;

// Storage
const jobs = new Map();
const DATA_DIR = path.join(__dirname, 'data');
const FILES_DIR = path.join(DATA_DIR, 'files');
const SCREENSHOTS_DIR = path.join(DATA_DIR, 'screenshots');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(FILES_DIR, { recursive: true });
fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

app.use(express.json({ limit: '100mb' }));
app.use(express.static('public'));
app.use('/files', express.static(FILES_DIR));
app.use('/screenshots', express.static(SCREENSHOTS_DIR));

// ============================================================
// HELPERS
// ============================================================

function createId() {
    return crypto.randomBytes(8).toString('hex');
}

function now() {
    return new Date().toISOString();
}

function getDomain(url) {
    try {
        return new URL(url).hostname;
    } catch {
        return null;
    }
}

function safeFilename(name) {
    return name.replace(/[^a-zA-Z0-9.-]/g, '_').slice(0, 200);
}

// ============================================================
// THE ULTIMATE SCRAPER - FINDS HIDDEN STUFF
// ============================================================

async function startScraping(url, options = {}) {
    const jobId = createId();

    const job = {
        id: jobId,
        status: 'starting',
        url: url,
        domain: getDomain(url),
        startedAt: now(),
        completedAt: null,

        // ============================================================
        // HIDDEN DATA DISCOVERY
        // ============================================================

        // Exposed Secrets & Credentials
        secrets: {
            apiKeys: [],
            awsKeys: [],
            jwtTokens: [],
            passwords: [],
            tokens: [],
            emails: [],
            phoneNumbers: [],
            ipAddresses: [],
            internalUrls: [],
            databaseUrls: [],
            privateKeys: []
        },

        // Hidden API Endpoints
        hiddenApis: [],
        graphqlEndpoints: [],
        websocketEndpoints: [],
        undocumentedEndpoints: [],

        // JavaScript Analysis
        jsAnalysis: {
            allJsContent: '',
            variables: [],
            functions: [],
            classes: [],
            imports: [],
            exports: [],
            webpackChunks: [],
            sourceMaps: []
        },

        // All Files Found
        files: {
            js: [],
            css: [],
            html: [],
            images: [],
            videos: [],
            pdf: [],
            json: [],
            xml: [],
            yaml: [],
            env: [],
            config: [],
            other: []
        },

        // Network Analysis
        networkCalls: [],
        apiCalls: [],
        responseBodies: [],

        // Page Data
        pages: [{
            url: url,
            html: '',
            text: '',
            links: [],
            forms: [],
            inputs: [],
            scripts: [],
            styles: []
        }],

        // Everything Else
        cookies: [],
        localStorage: [],
        sessionStorage: [],
        errors: [],
        consoleLogs: [],
        performance: {}
    };

    jobs.set(jobId, job);

    // Start scraping
    runUltimateScraper(jobId, options).catch(err => {
        job.errors.push({ message: err.message, timestamp: now() });
        job.status = 'failed';
    });

    return jobId;
}

async function runUltimateScraper(jobId, options) {
    const job = jobs.get(jobId);
    if (!job) return;

    let browser = null;

    try {
        browser = await chromium.launch({
            headless: true,
            args: [
                '--disable-blink-features=AutomationControlled',
                '--disable-dev-shm-usage',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-web-security',
                '--disable-features=IsolateOrigins,site-per-process'
            ]
        });

        const context = await browser.newContext({
            viewport: { width: 1920, height: 1080 },
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            ignoreHTTPSErrors: true,
            javaScriptEnabled: true
        });

        const page = await context.newPage();

        // ============================================================
        // INTERCEPT ALL NETWORK TRAFFIC
        // ============================================================

        await page.route('**/*', async (route) => {
            const request = route.request();
            const url = request.url();
            const method = request.method();

            // Check for hidden data in request
            const postData = request.postData() || '';
            if (postData.includes('password') || postData.includes('token')) {
                job.secrets.tokens.push({
                    url: url,
                    data: postData.substring(0, 500),
                    timestamp: now()
                });
            }

            // Detect API calls
            const isApi = (
                url.includes('/api/') ||
                url.includes('/v1/') ||
                url.includes('/v2/') ||
                url.includes('/graphql') ||
                url.includes('/rest/')
            );

            if (isApi) {
                const apiCall = {
                    url: url,
                    method: method,
                    headers: request.headers(),
                    postData: postData,
                    timestamp: now()
                };
                job.apiCalls.push(apiCall);
                job.hiddenApis.push(url);
            }

            // Get response
            try {
                const response = await route.fetch();
                const body = await response.body();
                const contentType = response.headers()['content-type'] || '';

                // Check response for secrets
                const bodyText = body.toString('utf-8');
                
                // Scan for AWS Keys
                const awsMatches = bodyText.match(/AKIA[0-9A-Z]{16}/g);
                if (awsMatches) {
                    job.secrets.awsKeys.push(...awsMatches.map(key => ({
                        key: key,
                        source: url,
                        timestamp: now()
                    })));
                }

                // Scan for JWT Tokens
                const jwtMatches = bodyText.match(/eyJ[a-zA-Z0-9-_]+\.[a-zA-Z0-9-_]+\.[a-zA-Z0-9-_]+/g);
                if (jwtMatches) {
                    job.secrets.jwtTokens.push(...jwtMatches.map(token => ({
                        token: token.substring(0, 100),
                        source: url,
                        timestamp: now()
                    })));
                }

                // Scan for API Keys
                const apiKeyMatches = bodyText.match(/['"](api[_-]?key|apikey|token)['"]?\s*[:=]\s*['"][a-zA-Z0-9-_]+['"]/gi);
                if (apiKeyMatches) {
                    job.secrets.apiKeys.push(...apiKeyMatches.map(match => ({
                        match: match.substring(0, 100),
                        source: url,
                        timestamp: now()
                    })));
                }

                // Scan for passwords
                const passwordMatches = bodyText.match(/['"]password['"]?\s*[:=]\s*['"][^'"]+['"]/gi);
                if (passwordMatches) {
                    job.secrets.passwords.push(...passwordMatches.map(match => ({
                        match: match.substring(0, 100),
                        source: url,
                        timestamp: now()
                    })));
                }

                // Scan for emails
                const emailMatches = bodyText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
                if (emailMatches) {
                    job.secrets.emails.push(...emailMatches.map(email => ({
                        email: email,
                        source: url,
                        timestamp: now()
                    })));
                }

                // Scan for IP addresses
                const ipMatches = bodyText.match(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g);
                if (ipMatches) {
                    job.secrets.ipAddresses.push(...ipMatches.map(ip => ({
                        ip: ip,
                        source: url,
                        timestamp: now()
                    })));
                }

                // Scan for private keys
                const privateKeyMatches = bodyText.match(/-----BEGIN [A-Z]+ PRIVATE KEY-----/g);
                if (privateKeyMatches) {
                    job.secrets.privateKeys.push({
                        match: privateKeyMatches[0],
                        source: url,
                        timestamp: now()
                    });
                }

                // Save response
                job.responseBodies.push({
                    url: url,
                    contentType: contentType,
                    body: bodyText.substring(0, 5000),
                    timestamp: now()
                });

                await route.fulfill({ response });
            } catch (error) {
                await route.continue();
            }
        });

        // ============================================================
        // SCRAPE PAGE
        // ============================================================

        await page.goto(url, {
            waitUntil: 'networkidle',
            timeout: 60000
        });

        await page.waitForTimeout(3000);

        // Scroll to load lazy content
        await page.evaluate(async () => {
            await new Promise((resolve) => {
                let totalHeight = 0;
                const distance = 100;
                const timer = setInterval(() => {
                    const scrollHeight = document.body.scrollHeight;
                    window.scrollBy(0, distance);
                    totalHeight += distance;
                    if (totalHeight >= scrollHeight || totalHeight > 5000) {
                        clearInterval(timer);
                        resolve();
                    }
                }, 100);
            });
        });

        await page.waitForTimeout(2000);

        // ============================================================
        // EXTRACT EVERYTHING
        // ============================================================

        const pageData = await page.evaluate(() => {
            // Get all links
            const links = Array.from(document.querySelectorAll('a[href]'))
                .map(a => a.href)
                .filter(Boolean);

            // Get all scripts
            const scripts = Array.from(document.querySelectorAll('script'))
                .map(script => ({
                    src: script.src || 'inline',
                    content: script.textContent || '',
                    type: script.type || 'text/javascript'
                }));

            // Get all styles
            const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
                .map(style => ({
                    href: style.href || 'inline',
                    content: style.textContent || ''
                }));

            // Get all forms
            const forms = Array.from(document.querySelectorAll('form'))
                .map(form => ({
                    action: form.action,
                    method: form.method,
                    inputs: Array.from(form.querySelectorAll('input')).map(input => ({
                        name: input.name,
                        type: input.type,
                        value: input.value || ''
                    }))
                }));

            // Get all images
            const images = Array.from(document.querySelectorAll('img'))
                .map(img => ({
                    src: img.src || img.dataset.src || '',
                    alt: img.alt || ''
                }));

            // Get console logs
            const consoleLogs = [];
            const originalLog = console.log;
            const originalError = console.error;
            const originalWarn = console.warn;

            console.log = (...args) => {
                consoleLogs.push({ type: 'log', message: args.join(' '), timestamp: new Date().toISOString() });
                originalLog.apply(console, args);
            };
            console.error = (...args) => {
                consoleLogs.push({ type: 'error', message: args.join(' '), timestamp: new Date().toISOString() });
                originalError.apply(console, args);
            };
            console.warn = (...args) => {
                consoleLogs.push({ type: 'warn', message: args.join(' '), timestamp: new Date().toISOString() });
                originalWarn.apply(console, args);
            };

            // Get cookies
            const cookies = document.cookie.split(';').map(c => c.trim());

            // Get localStorage
            const localStorageData = {};
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                localStorageData[key] = localStorage.getItem(key);
            }

            // Get sessionStorage
            const sessionStorageData = {};
            for (let i = 0; i < sessionStorage.length; i++) {
                const key = sessionStorage.key(i);
                sessionStorageData[key] = sessionStorage.getItem(key);
            }

            // Get all text
            const allText = document.body?.innerText || '';

            // Get all HTML
            const allHtml = document.documentElement.outerHTML;

            // Get JavaScript variables
            const jsVariables = Object.keys(window).filter(key => 
                !key.startsWith('_') && 
                typeof window[key] !== 'function'
            );

            // Get JavaScript functions
            const jsFunctions = Object.keys(window).filter(key => 
                typeof window[key] === 'function'
            );

            // Get SEO data
            const seo = {
                title: document.title,
                description: document.querySelector('meta[name="description"]')?.content || '',
                keywords: document.querySelector('meta[name="keywords"]')?.content || '',
                ogTags: {},
                metaTags: Array.from(document.querySelectorAll('meta')).map(meta => ({
                    name: meta.name || meta.property || '',
                    content: meta.content || ''
                }))
            };

            document.querySelectorAll('meta[property^="og:"]').forEach(meta => {
                seo.ogTags[meta.getAttribute('property')] = meta.content;
            });

            // Get social links
            const socialLinks = [];
            const socialPatterns = [
                /facebook\.com/i,
                /twitter\.com/i,
                /instagram\.com/i,
                /linkedin\.com/i,
                /youtube\.com/i,
                /github\.com/i,
                /reddit\.com/i,
                /tiktok\.com/i
            ];
            links.forEach(link => {
                if (socialPatterns.some(pattern => pattern.test(link))) {
                    socialLinks.push(link);
                }
            });

            // Get emails from page
            const pageEmails = allText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];

            // Get phone numbers
            const phoneNumbers = allText.match(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g) || [];

            return {
                links,
                scripts,
                styles,
                forms,
                images,
                consoleLogs,
                cookies,
                localStorage: localStorageData,
                sessionStorage: sessionStorageData,
                allText,
                allHtml,
                jsVariables,
                jsFunctions,
                seo,
                socialLinks,
                pageEmails,
                phoneNumbers,
                title: document.title,
                url: window.location.href
            };
        });

        // ============================================================
        // SAVE TO JOB
        // ============================================================

        job.pages[0] = {
            url: url,
            html: pageData.allHtml,
            text: pageData.allText,
            title: pageData.title,
            links: pageData.links,
            forms: pageData.forms,
            scripts: pageData.scripts,
            styles: pageData.styles,
            images: pageData.images
        };

        job.consoleLogs = pageData.consoleLogs;
        job.cookies = pageData.cookies;
        job.localStorage = pageData.localStorage;
        job.sessionStorage = pageData.sessionStorage;

        // Add to secrets
        job.secrets.emails.push(...pageData.pageEmails.map(email => ({
            email: email,
            source: url,
            timestamp: now()
        })));

        job.secrets.phoneNumbers.push(...pageData.phoneNumbers.map(phone => ({
            phone: phone,
            source: url,
            timestamp: now()
        })));

        job.secrets.tokens.push(...pageData.consoleLogs
            .filter(log => log.message.includes('token') || log.message.includes('secret'))
            .map(log => ({
                message: log.message.substring(0, 200),
                source: 'console',
                timestamp: now()
            }))
        );

        // ============================================================
        // ANALYZE JAVASCRIPT FILES
        // ============================================================

        const jsFiles = pageData.scripts.filter(s => s.src && !s.src.startsWith('data:'));
        
        for (const script of jsFiles) {
            try {
                const response = await axios.get(script.src, {
                    timeout: 10000,
                    headers: { 'User-Agent': 'Mozilla/5.0' }
                });
                
                const content = response.data;
                job.jsAnalysis.allJsContent += content + '\n';

                // Scan JS for secrets
                const secretPatterns = {
                    awsKeys: /AKIA[0-9A-Z]{16}/g,
                    apiKeys: /['"](api[_-]?key|apikey|token)['"]?\s*[:=]\s*['"][a-zA-Z0-9-_]+['"]/gi,
                    jwtTokens: /eyJ[a-zA-Z0-9-_]+\.[a-zA-Z0-9-_]+\.[a-zA-Z0-9-_]+/g,
                    passwords: /['"]password['"]?\s*[:=]\s*['"][^'"]+['"]/gi,
                    emails: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
                    urls: /https?:\/\/[^\s'"]+/g,
                    graphql: /graphql/i,
                    webpackChunks: /webpackChunk_[a-zA-Z0-9]+/g
                };

                for (const [key, pattern] of Object.entries(secretPatterns)) {
                    const matches = content.match(pattern);
                    if (matches) {
                        if (key === 'awsKeys') {
                            job.secrets.awsKeys.push(...matches.map(m => ({
                                key: m,
                                source: script.src,
                                timestamp: now()
                            })));
                        } else if (key === 'jwtTokens') {
                            job.secrets.jwtTokens.push(...matches.map(m => ({
                                token: m.substring(0, 100),
                                source: script.src,
                                timestamp: now()
                            })));
                        } else if (key === 'emails') {
                            job.secrets.emails.push(...matches.map(m => ({
                                email: m,
                                source: script.src,
                                timestamp: now()
                            })));
                        } else if (key === 'urls') {
                            matches.forEach(url => {
                                if (url.includes('/api/') || url.includes('/v1/')) {
                                    job.hiddenApis.push({
                                        url: url,
                                        source: script.src,
                                        timestamp: now()
                                    });
                                }
                            });
                        } else if (key === 'webpackChunks') {
                            job.jsAnalysis.webpackChunks.push(...matches.map(m => ({
                                chunk: m,
                                source: script.src,
                                timestamp: now()
                            })));
                        }
                    }
                }

                // Save JS file
                const filename = safeFilename(path.basename(script.src)) || 'script.js';
                const filepath = path.join(FILES_DIR, `${job.id}_${filename}`);
                fs.writeFileSync(filepath, content);
                job.files.js.push({
                    url: script.src,
                    local: filepath,
                    size: content.length,
                    timestamp: now()
                });

            } catch (error) {
                // Skip if can't download
            }
        }

        // ============================================================
        // FIND HIDDEN ENDPOINTS IN HTML
        // ============================================================

        const htmlContent = pageData.allHtml;
        const endpointPatterns = [
            /['"](https?:\/\/[^'"]+\/api\/[^'"]+)['"]/g,
            /['"](https?:\/\/[^'"]+\/v\d\/[^'"]+)['"]/g,
            /['"](https?:\/\/[^'"]+\/graphql)['"]/g,
            /['"](https?:\/\/[^'"]+\/rest\/[^'"]+)['"]/g,
            /['"](https?:\/\/[^'"]+\/services\/[^'"]+)['"]/g,
            /['"](https?:\/\/[^'"]+\/auth\/[^'"]+)['"]/g
        ];

        for (const pattern of endpointPatterns) {
            const matches = htmlContent.match(pattern);
            if (matches) {
                matches.forEach(match => {
                    const clean = match.replace(/['"]/g, '');
                    if (!job.hiddenApis.some(h => h.url === clean)) {
                        job.hiddenApis.push({
                            url: clean,
                            source: 'html',
                            timestamp: now()
                        });
                    }
                });
            }
        }

        // ============================================================
        // TAKE SCREENSHOTS
        // ============================================================

        // Full page screenshot
        const screenshotPath = path.join(SCREENSHOTS_DIR, `${job.id}_full.png`);
        await page.screenshot({ path: screenshotPath, fullPage: true });
        job.screenshot = `/screenshots/${job.id}_full.png`;

        // ============================================================
        // COMPLETE
        // ============================================================

        job.status = 'completed';
        job.completedAt = now();

        console.log(`✅ Job ${jobId} completed!`);
        console.log(`   Found ${job.apiCalls.length} API calls`);
        console.log(`   Found ${job.secrets.apiKeys.length} API keys`);
        console.log(`   Found ${job.secrets.jwtTokens.length} JWT tokens`);
        console.log(`   Found ${job.secrets.emails.length} emails`);

    } catch (error) {
        job.status = 'failed';
        job.errors.push({
            message: error.message,
            stack: error.stack,
            timestamp: now()
        });
        console.error(`❌ Job ${jobId} failed:`, error.message);
    } finally {
        if (browser) {
            await browser.close().catch(() => {});
        }
    }
}

// ============================================================
// API ENDPOINTS
// ============================================================

// Start scraping
app.post('/api/scrape', async (req, res) => {
    const { url } = req.body;
    
    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    const jobId = await startScraping(url);
    res.json({ jobId: jobId });
});

// Get job status
app.get('/api/jobs/:id', (req, res) => {
    const job = jobs.get(req.params.id);
    if (!job) {
        return res.status(404).json({ error: 'Job not found' });
    }

    // Return summary (without huge data)
    const summary = {
        id: job.id,
        status: job.status,
        url: job.url,
        domain: job.domain,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        stats: {
            apiCalls: job.apiCalls.length,
            hiddenApis: job.hiddenApis.length,
            secretsFound: {
                apiKeys: job.secrets.apiKeys.length,
                awsKeys: job.secrets.awsKeys.length,
                jwtTokens: job.secrets.jwtTokens.length,
                passwords: job.secrets.passwords.length,
                emails: job.secrets.emails.length,
                ipAddresses: job.secrets.ipAddresses.length
            },
            pages: job.pages.length,
            errors: job.errors.length
        }
    };

    res.json(summary);
});

// Get full job data
app.get('/api/jobs/:id/full', (req, res) => {
    const job = jobs.get(req.params.id);
    if (!job) {
        return res.status(404).json({ error: 'Job not found' });
    }

    res.json(job);
});

// Export as JSON
app.get('/api/jobs/:id/export', (req, res) => {
    const job = jobs.get(req.params.id);
    if (!job) {
        return res.status(404).json({ error: 'Job not found' });
    }

    const filename = `scrape_${job.id}_${job.domain}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.json(job);
});

// ============================================================
// SERVE FRONTEND
// ============================================================

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 Ultimate Scraper running on http://localhost:${PORT}`);
    console.log(`📂 Data saved to: ${DATA_DIR}`);
});
