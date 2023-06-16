const functions = require("firebase-functions");
const admin = require("firebase-admin");
const express = require("express");
const serviceAccount = require('./trashcare-387803-firebase-adminsdk-hi4at-f6df30114e.json');
const Joi = require('joi');
const { v4: uuidv4 } = require('uuid');


admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const app = express();
app.use(express.json());

// Skema pengisian data
const trashDataPayloadSchema = Joi.object({
  description: Joi.string().required().messages({
    'string.base': 'Deskripsi harus berupa teks',
    'any.required': 'Deskripsi wajib diisi',
  }),
  location: Joi.string().required().messages({
    'string.base': 'Lokasi harus berupa teks',
    'any.required': 'Lokasi wajib diisi',
  }),
  amount: Joi.number().integer().positive().required().messages({
    'number.base': 'Jumlah harus berupa angka',
    'number.integer': 'Jumlah harus berupa bilangan bulat',
    'number.positive': 'Jumlah tidak boleh negatif',
    'any.required': 'Jumlah wajib diisi',
  }),
});

let trashCounter = 1;

app.post('/submittrash', async (req, res) => {
  try {
    const { error, value } = trashDataPayloadSchema.validate(req.body, { abortEarly: false });
    if (error) {
      const errorMessage = error.details.map((err) => err.message);
      return res.status(400).json({ message: errorMessage });
    }

    const { description, location, amount } = value;

    // Get trashId paling terakhir
    const lastTrashSnapshot = await admin.firestore().collection('trashdispose').orderBy('trashId', 'desc').limit(1).get();
    let lastTrashId = 'T000';

    if (!lastTrashSnapshot.empty) {
      const lastTrashData = lastTrashSnapshot.docs[0].data();
      lastTrashId = lastTrashData.trashId;
    }

    // Membuat trashId selanjutnya
    let trashNumber = parseInt(lastTrashId.slice(1)) + 1;
    let trashId = `T${trashNumber.toString().padStart(3, '0')}`;

    // Custom token
    const authorizationHeader = req.headers.authorization;
    if (!authorizationHeader || !authorizationHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Tidak diizinkan" });
    }

    // UserId
    const userId = req.headers.userid;

    // Simpan data sampah ke collection trashdispose pada Firestore
    const trashData = {
      trashId,
      userId,
      description,
      location,
      amount,
      status: "Pending",
    };

    await admin.firestore().collection('trashdispose').add(trashData);

    res.status(200).json({
      message: "Submit sampah berhasil! Silakan tunggu verifikasi dari admin untuk menerima komisi.",
    });
  } catch (error) {
    console.error('Submit trash data error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan saat menyimpan data sampah.' });
  }
});

exports.apisubmittrash = functions.https.onRequest(app);

// Tes di lokal
// app.listen(3000, () => {
//   console.log('Server is running on port 3000');
// });