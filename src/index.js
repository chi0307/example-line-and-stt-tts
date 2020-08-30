const express = require('express');
const path = require('path');
const fs = require('fs');
require('dotenv').config();
const line = require('@line/bot-sdk');
const linear16 = require('linear16');
const googleSpeech = require('@google-cloud/speech');
const googleTextToSpeech = require('@google-cloud/text-to-speech');
const util = require('util');
const { getAudioDurationInSeconds } = require('get-audio-duration');

// 確認 env 輸入是否正確
if (
  !process.env.HOST_PATH ||
  !process.env.LINE_CHANNEL_ACCESS_TOKEN ||
  !process.env.LINE_CHANNEL_SECRET ||
  !process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  !process.env.AUDIO_FILE_SAVE_PATH
) {
  throw 'env error';
}

// 音檔回傳 line 提供的位置
const hostPath = process.env.HOST_PATH + (/\/$/.test(process.env.HOST_PATH) ? '' : '/');
// 音檔下載位置（位於專案中的相對位置）
const fileSavePath = process.env.AUDIO_FILE_SAVE_PATH;

// 確認 public 目錄有沒有存在，不存在新增目錄
fs.access(fileSavePath, (err) => {
  if (err && err.code == 'ENOENT') {
    throw 'AUDIO SAVE ENOENT';
  }
});

// 確認 google credentials 檔案是否存在
fs.access(process.env.GOOGLE_APPLICATION_CREDENTIALS, (err) => {
  if (err) {
    throw err;
  }
});

const app = express();
const port = process.env.PORT || 3000;
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const lineClient = new line.Client({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
});

// Google text-to-speech speech-to-text 語言
const languageCode = 'zh-TW';
const speechClient = new googleSpeech.SpeechClient();
const textToSpeechClient = new googleTextToSpeech.TextToSpeechClient();

// 儲存音檔
async function saveAudio(audioContent, fileName = 'input.mp3') {
  if (!audioContent) {
    throw 'No AudioContent';
  }
  const writeFile = util.promisify(fs.writeFile);
  await writeFile(fileName, audioContent, 'binary');
}

// 文字轉音檔，回傳 line audio object
async function textToLineAudioObject(replyText) {
  let fileName = `${new Date().getTime()}-output.mp3`;
  let filePath = `${fileSavePath}${fileName}`;
  const text = replyText;
  const [response] = await textToSpeechClient.synthesizeSpeech({
    input: { text },
    voice: { languageCode, ssmlGender: 'NEUTRAL' },
    audioConfig: { audioEncoding: 'MP3' },
  });
  let audioContent = response.audioContent;
  const writeFile = util.promisify(fs.writeFile);
  await writeFile(filePath, audioContent, 'binary');
  let audioDuration = await getAudioDurationInSeconds(filePath).then((duration) => {
    return duration * 1000;
  });
  console.log('originalContentUrl', `${hostPath}public/audio/${fileName}`);
  return {
    type: 'audio',
    originalContentUrl: `${hostPath}public/audio/${fileName}`,
    duration: audioDuration,
  };
}

// 暫時性確認 輸入文字 回傳文字
async function inputAndReply(inputText) {
  let obj = [];
  if (inputText.includes('印表機不能使用')) {
    obj = [
      await textToLineAudioObject(`
        公司所附的印表機常見異常情形包含以下，請問是哪一種情形呢？「卡紙」、「碳粉不足」、「掃描異常」、「其他」
      `),
      {
        type: 'template',
        altText: '請點擊進入查看選單',
        template: {
          type: 'buttons',
          text: '公司所附的印表機常見異常情形包含以下，請問是哪一種情形呢？',
          actions: [
            { label: '卡紙', type: 'message', text: '卡紙' },
            { label: '碳粉不足', type: 'message', text: '碳粉不足' },
            { label: '掃描異常', type: 'message', text: '掃描異常' },
            { label: '其他', type: 'message', text: '其他' },
          ],
        },
      },
    ];
  } else if (inputText.includes('掃描異常')) {
    obj = [
      await textToLineAudioObject(`
        印表機掃描功能的常見異常包含以下，請問是哪一種情形呢？「掃描沒有反應」、「掃描圖像瑕疵」、「檔案無法接收」、「其他」
      `),
      {
        type: 'template',
        altText: '請點擊進入查看選單',
        template: {
          type: 'buttons',
          text: '印表機掃描功能的常見異常包含以下，請問是哪一種情形呢？',
          actions: [
            { label: '掃描沒有反應', type: 'message', text: '掃描沒有反應' },
            { label: '掃描圖像瑕疵', type: 'message', text: '掃描圖像瑕疵' },
            { label: '檔案無法接收', type: 'message', text: '檔案無法接收' },
            { label: '其他', type: 'message', text: '其他' },
          ],
        },
      },
    ];
  } else if (inputText.includes('掃描圖像瑕疵')) {
    obj = [
      await textToLineAudioObject(`
        掃描後檔案有污點或黑線可能為玻璃鏡面髒污導致，請試著清潔大小兩片玻璃鏡面之污點處後重試，若清潔後仍未修復請聯繫 1 9 9 9 由專員協助。
      `),
      {
        type: 'template',
        altText: '請點擊進入查看選單',
        template: {
          type: 'buttons',
          text:
            '掃描後檔案有污點或黑線可能為玻璃鏡面髒污導致，請試著清潔大小兩片玻璃鏡面之污點處後重試，若清潔後仍未修復請聯繫 1999 由專員協助。',
          actions: [{ label: '撥打 1999 電話', type: 'message', text: ' ' }],
        },
      },
      {
        type: 'image',
        originalContentUrl: `${hostPath}public/image/01.png`,
        previewImageUrl: `${hostPath}public/image/01.png`,
      },
    ];
  } else {
    obj = [
      {
        type: 'text',
        text: '目前找不到你想問的，請重新輸入。',
      },
    ];
  }
  return obj;
}

app.all('*', (req, res, next) => {
  console.log(req.method, req.url);
  next();
});

app.post('/', async (req, res) => {
  if (req.body && req.body.events) {
    for (let event of req.body.events) {
      if (event.type === 'message') {
        let message = event.message;
        if (event.source.type === 'user') {
          let userId = event.source.userId,
            replyToken = event.replyToken,
            inputText,
            replyList;
          switch (message.type) {
            case 'text':
              inputText = message.text;
              replyList = await inputAndReply(inputText);
              for (let reply of replyList) {
                lineClient.pushMessage(userId, reply);
              }
              break;
            case 'audio':
              let filePath = `${fileSavePath}${new Date().getTime()}.m4a`;

              await lineClient.getMessageContent(message.id).then(
                (stream) =>
                  new Promise((resolve, reject) => {
                    const writable = fs.createWriteStream(filePath);
                    stream.pipe(writable);
                    stream.on('end', () => resolve(filePath));
                    stream.on('error', reject);
                  })
              );
              filePath = await linear16(filePath, filePath.replace(/\.\w*$/, '.wav'));

              const file = fs.readFileSync(filePath);
              const [response] = await speechClient.recognize({
                audio: {
                  content: file.toString('base64'),
                },
                config: {
                  encoding: 'LINEAR16',
                  sampleRateHertz: 16000,
                  languageCode,
                },
              });
              inputText = response.results.map((result) => result.alternatives[0].transcript).join('\n');

              let deleteFile = (file) => {
                fs.unlink(file, (err) => {
                  if (err) console.error(err);
                });
              };
              deleteFile(filePath);
              deleteFile(filePath.replace(/\.\w*$/, '.m4a'));

              console.log(`Google 語音辨識為：${inputText}`);

              replyList = await inputAndReply(inputText);
              for (let reply of replyList) {
                lineClient.pushMessage(userId, reply);
              }
              break;
            default:
              console.log('Other Message', message);
              break;
          }
        }
      }
    }
    res.send();
  }
});

app.use('/public', express.static('./public'));

app.listen(port, () => {
  console.log(`Open http://localhost:${port}`);
});
