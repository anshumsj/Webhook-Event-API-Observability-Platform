const crypto = require('crypto');
const secret = '0781ad954296f6050048bfd84f4b28d4283161f653f1a23b';
const rawBody = '{"message":"Test attempt signature (Commit 35)","commits":1}';
const signature = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
console.log('Computed signature:', signature);
console.log('Expected signature: 2cb725a3ea9073225a61b5ec767d0ecdd1ba733d92e89cd3b7d180c8e8f09b7f');
console.log('Matches?', signature === '2cb725a3ea9073225a61b5ec767d0ecdd1ba733d92e89cd3b7d180c8e8f09b7f');
