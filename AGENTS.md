# Portfolio Agent Qoidalari

- Menga doim o'zbek tilida javob ber.
- Kodda kommentariya yozma.
- Kod faqat professional, optimal va clean-code darajasida yozilsin.
- `any` va noaniq type ishlatilmasin, TypeScript strict yondashuv saqlansin.
- Business logic UI komponent ichiga sochilmasin, servis va domain qatlamlari aniq ajratilsin.
- Runtime xatolarni yashirish o'rniga typed validation va aniq error handling ishlatilsin.
- Lock faylga qarab package manager tanlansin: `pnpm-lock.yaml -> pnpm`, `package-lock.json -> npm`, `bun.lockb -> bun`.
- O'zgargan kod uchun minimal gate: `just verify` yoki mos ravishda `format`, `lint`, `typecheck`, `test`.
- Task tugagach avtomatik self-review qilinsin; bug, regression va architecture risk yopilmasdan ish yakunlanmasin.

## Tezkor runtime verification

- Web verification va chuqur debug uchun default tool `Playwright` bo'lsin.
- Takrorlanuvchi smoke yoki web bilan mobil surface umumiy user-journey kerak bo'lsa `Maestro MCP` yoki `maestro` CLI ishlatilsin.
- Saved session, aniq route va minimal reproduksiya afzal bo'lsin.
- Screenshot final evidence uchun olinsin; console, network va DOM/assert asosiy signal bo'lsin.
