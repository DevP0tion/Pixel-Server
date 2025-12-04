import admin from 'firebase-admin';
import { getAuth } from 'firebase-admin/auth';
import sdk from '../../../key/firebase-sdk.json';

export function initializeFirebase() {
  // Firebase initialization logic
  const app = admin.initializeApp({
    credential: admin.credential.cert({
      clientEmail: sdk.client_email,
      privateKey: sdk.private_key,
      projectId: sdk.project_id
    }),
    projectId: sdk.project_id,
    databaseURL: `https://${sdk.project_id}.firebaseio.com`,
    serviceAccountId: sdk.client_email,
  }, "pixel-server");

  const auth = getAuth(app);

  console.log('Firebase 프로젝트 초기화 완료:', sdk.project_id);

  return { app, auth }
}