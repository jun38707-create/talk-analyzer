import { GoogleGenerativeAI } from "@google/generative-ai";

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
dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
        handleFileSelect(e.dataTransfer.files[0]);
    }
});

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
}

removeFileBtn.addEventListener('click', () => {
    selectedFile = null;
    fileInput.value = '';
    fileInfo.classList.add('hidden');
    analyzeBtn.disabled = true;
});

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
        const genAI = new GoogleGenerativeAI(apiKey);

        // 시도해볼 모델 목록 (404 오류 대응을 위해 순차적으로 시도)
        const modelsToTry = ["gemini-1.5-flash", "gemini-1.5-flash-latest", "gemini-1.5-pro", "gemini-2.0-flash-exp"];
        let result = null;
        let lastError = null;

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

        for (const modelName of modelsToTry) {
            try {
                console.log(`Trying model: ${modelName}...`);
                const model = genAI.getGenerativeModel({ model: modelName });

                if (selectedFile.type.startsWith('audio/')) {
                    const base64Data = await fileToBase64(selectedFile);
                    result = await model.generateContent([
                        prompt,
                        {
                            inlineData: {
                                mimeType: selectedFile.type,
                                data: base64Data
                            }
                        }
                    ]);
                } else {
                    const textContent = await selectedFile.text();
                    result = await model.generateContent([prompt, textContent]);
                }

                if (result) break; // 성공 시 루프 종료
            } catch (err) {
                console.warn(`${modelName} 시도 실패:`, err.message);
                lastError = err;
            }
        }

        if (!result) {
            throw new Error(`모든 모델 시도에 실패했습니다. API 키의 권한이나 지역 제한을 확인하세요. 마지막 오류: ${lastError?.message}`);
        }

        const responseText = result.response.text();
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);

        if (jsonMatch) {
            const data = JSON.parse(jsonMatch[0]);
            myArgumentEl.textContent = data.myArgument;
            otherArgumentEl.textContent = data.otherArgument;
            contextSummaryEl.textContent = data.context;
        } else {
            // JSON 파싱 실패 시 일반 텍스트로 표시
            contextSummaryEl.textContent = responseText;
            myArgumentEl.textContent = "리포트 참조";
            otherArgumentEl.textContent = "리포트 참조";
        }

    } catch (error) {
        console.error('분석 중 최종 오류 발생:', error);
        alert('분석 중 오류가 발생했습니다: ' + error.message);
    } finally {
        loadingOverlay.classList.add('hidden');
        analysisContent.classList.remove('hidden');
        analyzeBtn.disabled = false;
    }
});

async function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = error => reject(error);
    });
}

function parseAndDisplayResult(text) {
    // 간단한 파싱 로직 (AI 응답 형식에 따라 조정 필요)
    // 실제로는 더 정교한 정규표현식이나 구조화된 출력이 좋음
    const blocks = text.split(/\d\./);

    if (blocks.length >= 4) {
        myArgumentEl.textContent = blocks[1].trim();
        otherArgumentEl.textContent = blocks[2].trim();
        contextSummaryEl.textContent = blocks[3].trim();
    } else {
        // 파싱 실패 시 전체 텍스트 출력
        contextSummaryEl.textContent = text;
        myArgumentEl.textContent = "분석 리포트 참조";
        otherArgumentEl.textContent = "분석 리포트 참조";
    }
}
