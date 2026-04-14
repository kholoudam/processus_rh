// src/services/drive.service.js

exports.uploadToDrive = (filePath) => {
  return "https://drive.google.com/fake-link/" + filePath.split('/').pop();
};