// DOM 요소
const apiKeyInput = document.getElementById('api-key');
const saveKeyBtn = document.getElementById('save-key');
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const fileInfo = document.getElementById('file-info');
const fileNameDisplay = document.getElementById('file-name');
const removeFileBtn = document.getElementById('remove-file');
const analyzeBtn = document.getElementById('analyze-btn');
const resultSection = document.getElementById('result-section');
const loadingOverlay = document.querySelector('.loading-overlay');
const analysisContent = document.getElementById('analysis-content');

const myArgumentEl = document.getElementById('my-argument');
const otherArgumentEl = document.getElementById('other-argument');
const contextSummaryEl = document.getElementById('context-summary');
const copyBtn = document.getElementById('copy-btn');
const saveTxtBtn = document.getElementById('save-txt-btn');

let selectedFile = null;

// 로컬 스토리지에서 API 키 로드
const savedKey = localStorage.getItem('gemini_api_key');
if (savedKey) {
    apiKeyInput.value = savedKey;
}

// API 키 저장
saveKeyBtn.addEventListener('click', () => {
    const key = apiKeyInput.value.trim();
    if (key) {
        localStorage.setItem('gemini_api_key', key);
        alert('API 키가 성공적으로 저장되었습니다.');
    } else {
        alert('API 키를 입력해주세요.');
    }
});

// 파일 업로드 처리
fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFileSelect(e.target.files[0]);
    }
});

function handleFileSelect(file) {
    selectedFile = file;
    fileNameDisplay.textContent = file.name;
    fileInfo.classList.remove('hidden');
    analyzeBtn.disabled = false;
    analysisContent.classList.add('hidden');
}

removeFileBtn.addEventListener('click', () => {
    selectedFile = null;
    fileInput.value = '';
    fileInfo.classList.add('hidden');
    analyzeBtn.disabled = true;
});

// 라이브러리 없이 직접 API를 호출하는 함수
async function callGeminiAPI(apiKey, prompt, file) {
    const modelsToTry = ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-1.5-pro"];
    let lastError = null;

    for (const modelName of modelsToTry) {
        try {
            console.log(`Trying model: ${modelName}...`);
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
            
            let parts = [{ text: prompt }];
            
            if (file) {
                let mimeType = file.type;
                if (!mimeType && file.name.endsWith('.m4a')) mimeType = 'audio/x-m4a';
                if (!mimeType && file.name.endsWith('.mp3')) mimeType = 'audio/mpeg';
                if (!mimeType) mimeType = 'audio/x-m4a';
                
                const base64Data = await fileToBase64(file);
                parts.push({
                    inlineData: {
                        mimeType: mimeType,
                        data: base64Data
                    }
                });
            }

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts }] })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || 'API 요청 실패');
            }

            const data = await response.json();
            if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
                throw new Error('AI 응답 형식이 올바르지 않습니다.');
            }
            return data.candidates[0].content.parts[0].text;
        } catch (err) {
            console.warn(`${modelName} 시도 실패:`, err.message);
            lastError = err;
        }
    }
    throw lastError;
}

// 분석 로직
analyzeBtn.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
        alert('먼저 Gemini API 키를 입력해 주세요.');
        return;
    }

    if (!selectedFile) return;

    resultSection.classList.remove('hidden');
    loadingOverlay.classList.remove('hidden');
    analysisContent.classList.add('hidden');
    analyzeBtn.disabled = true;

    try {
        const prompt = `
            당신은 복잡한 대화나 녹음을 분석하여 핵심을 짚어주는 비서입니다.
            제공된 데이터를 분석하여 반드시 아래의 JSON 형식을 지켜서 답변해 주세요. 
            텍스트 외의 다른 설명은 하지 마세요.

            {
              "myArgument": "나의 핵심 주장 요약 (한국어)",
              "otherArgument": "상대방의 핵심 주장 요약 (한국어)",
              "context": "대화의 전체 배경, 주요 갈등 및 결론 요약 (한국어)"
            }
        `;

        const responseText = await callGeminiAPI(apiKey, prompt, selectedFile);
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);

        if (jsonMatch) {
            const data = JSON.parse(jsonMatch[0]);
            myArgumentEl.textContent = data.myArgument;
            otherArgumentEl.textContent = data.otherArgument;
            contextSummaryEl.textContent = data.context;
        } else {
            contextSummaryEl.textContent = responseText;
            myArgumentEl.textContent = "리포트 참조";
            otherArgumentEl.textContent = "리포트 참조";
        }
    } catch (error) {
        alert('분석 중 오류가 발생했습니다: ' + error.message);
    } finally {
        loadingOverlay.classList.add('hidden');
        analysisContent.classList.remove('hidden');
        analyzeBtn.disabled = false;
    }
});

// 클립보드 복사
copyBtn.addEventListener('click', () => {
    const textToCopy = `
[대화 맥락 분석 리포트]

1. 나의 핵심 주장:
${myArgumentEl.textContent}

2. 상대방의 핵심 주장:
${otherArgumentEl.textContent}

3. 전체 맥락 요약:
${contextSummaryEl.textContent}

---
분석일: ${new Date().toLocaleString()}
`.trim();

    navigator.clipboard.writeText(textToCopy).then(() => {
        alert('분석 결과가 클립보드에 복사되었습니다.');
    }).catch(err => {
        alert('복사 중 오류가 발생했습니다.');
    });
});

// 파일 저장
saveTxtBtn.addEventListener('click', () => {
    const textToSave = `
[대화 맥락 분석 리포트]

1. 나의 핵심 주장:
${myArgumentEl.textContent}

2. 상대방의 핵심 주장:
${otherArgumentEl.textContent}

3. 전체 맥락 요약:
${contextSummaryEl.textContent}

---
분석일: ${new Date().toLocaleString()}
`.trim();

    const blob = new Blob([textToSave], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const today = new Date().toISOString().split('T')[0];

    a.href = url;
    a.download = `대화분석결과_${today}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});

async function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = error => reject(error);
    });
}
