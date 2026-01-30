// DOM 요소
const apiKeyInput = document.getElementById('api-key');
const saveKeyBtn = document.getElementById('save-key');
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const fileInfo = document.getElementById('file-info');
const fileNameDisplay = document.getElementById('file-name');
const removeFileBtn = document.getElementById('remove-file');
const transcribeBtn = document.getElementById('transcribe-btn');
const resultSection = document.getElementById('result-section');
const loadingOverlay = document.querySelector('.loading-overlay');
const transcriptionContent = document.getElementById('transcription-content');

const transcriptBox = document.getElementById('transcript-box');
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
    const isAudioType = file.type.startsWith('audio/');
    const isAudioExt = /\.(mp3|m4a|wav|aac|ogg|flac)$/i.test(file.name);

    if (!isAudioType && !isAudioExt) {
        alert('오디오 파일(mp3, m4a, wav 등)만 업로드 가능합니다.');
        return;
    }
    selectedFile = file;
    fileNameDisplay.textContent = file.name;
    fileInfo.classList.remove('hidden');
    transcribeBtn.disabled = false;
    transcriptionContent.classList.add('hidden');
}

removeFileBtn.addEventListener('click', () => {
    selectedFile = null;
    fileInput.value = '';
    fileInfo.classList.add('hidden');
    transcribeBtn.disabled = true;
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

// STT 로직
transcribeBtn.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
        alert('먼저 Gemini API 키를 입력해 주세요.');
        return;
    }

    if (!selectedFile) return;

    resultSection.classList.remove('hidden');
    loadingOverlay.classList.remove('hidden');
    transcriptionContent.classList.add('hidden');
    transcribeBtn.disabled = true;

    try {
        const prompt = `
            당신은 전문적인 속기사입니다. 
            제공된 오디오 파일을 듣고 들리는 모든 대화를 **하나도 빠짐없이** 텍스트로 아주 정확하게 옮겨주세요 (Full Transcription).

            [지침]
            1. 화자가 바뀔 때마다 줄바꿈을 하고 '화자 1:', '화자 2:' 등으로 구분하세요.
            2. 기술적인 용어(특히 건설, 토목, 설비 등), 숫자, 단위(m, cm, kg, 구배, 지반고 등)를 들리는 대로 정확하게 기록하세요.
            3. **요약하지 마세요.** 추측하거나 생략하지 말고, 들리는 그대로 '직역'하듯이 전체 내용을 받아쓰세요.
            4. 배경 소음이나 도저히 알 수 없는 부분만 [불분명]으로 표시하세요.
            5. 한국어가 기본이지만 섞여있는 영어 단어와 전문 술어도 정확히 표기하세요.
        `;

        const responseText = await callGeminiAPI(apiKey, prompt, selectedFile);
        transcriptBox.innerHTML = responseText.replace(/\n/g, '<br>');

    } catch (error) {
        alert('변환 중 오류가 발생했습니다: ' + error.message);
    } finally {
        loadingOverlay.classList.add('hidden');
        transcriptionContent.classList.remove('hidden');
        transcribeBtn.disabled = false;
    }
});

// 클립보드 복사
copyBtn.addEventListener('click', () => {
    const textToCopy = transcriptBox.innerText;
    navigator.clipboard.writeText(textToCopy).then(() => {
        alert('텍스트가 클립보드에 복사되었습니다.');
    }).catch(err => {
        alert('복사 중 오류가 발생했습니다.');
    });
});

// 파일 저장
saveTxtBtn.addEventListener('click', () => {
    const textToSave = `[정밀 STT 결과 리포트]\n\n파일: ${selectedFile.name}\n일시: ${new Date().toLocaleString()}\n\n---\n\n${transcriptBox.innerText}`;
    const blob = new Blob([textToSave], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const today = new Date().toISOString().split('T')[0];

    a.href = url;
    a.download = `STT변환_${today}.txt`;
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
