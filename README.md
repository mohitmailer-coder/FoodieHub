# FoodieHub — full-stack

Aapka original template (design, cart animation, reviews slider — sab wahi hai).
Backend jo add kiya: real sign in, register, aur checkout — SQLite me save hota hai.

## Chalane ka tarika
```bash
npm install
npm start          # http://localhost:3000
```
Node 22.5+ chahiye (SQLite built-in hai, koi native build nahi lagta).

## Note: images
`images/` folder khaali hai — original upload me tasveerein nahi thi, sirf empty file thi.
Apni actual product/hero images `public/images/` me daal dijiye, wahi filenames use honge
jo `server.js` aur `index.html` me already likhe hain (jaise `burger.png`, `delivery-boy.png`).

## Kya jo hai
- **Cart**: bilkul pehle jaisa — client side, add/plus/minus, sign in ki zaroorat nahi
- **Sign in / Register**: header ke "Sign in" button pe click karke modal khulta hai;
  login hone ke baad button aapka naam dikhata hai
- **Checkout**: cart ke "Check out" button se — agar sign in nahi hai to pehle login maangega,
  phir address/city/phone leke order place karega
- **My Orders**: sign in ke baad account button dabane se aapke pichle orders dikhte hain

## Security
- Password bcrypt se hash (12 rounds)
- Order ka total hamesha server pe menu ki price se calculate hota hai — client se aaya
  price kabhi trust nahi hota
- Session cookie httpOnly

## Production se pehle
1. `SESSION_SECRET` env var set karein
2. HTTPS pe `cookie.secure = true` karein
3. Payment gateway jodein — abhi cash on delivery hai
4. Login pe rate limiting add karein
