const PSID = '27974952652091760';
const TOKEN = 'EAANegy5XgKABRUyZBP9xEmJLwhZANzLWPCrOrHZCUEqUBJKaWssi1pVvhYayZAKrDQ26k2bF1KH626S74RZClAZBGMnupvUYiGDjOzzshb4FoBLZAHcaWfLnMYZBMxjHGT02RQJeSAUOdYrIRUe8RlVHdwDcujX6RuY1asXp7yzZAqfaG7ZBM3WsHPQGhG6ywBiSoLBAypedOCyq7JKiekJruu';

fetch(`https://graph.facebook.com/${PSID}?fields=first_name,last_name,profile_pic&access_token=${TOKEN}`)
  .then(res => res.json())
  .then(console.log)
  .catch(console.error);
