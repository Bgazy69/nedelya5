import * as anchor from "@anchor-lang/core";
import { Program, AnchorProvider, Wallet } from "@anchor-lang/core";
import { Connection, Keypair, PublicKey, clusterApiUrl } from "@solana/web3.js";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

// IDL, сгенерированный командой `anchor build` (описывает интерфейс программы)
const idl = JSON.parse(
  fs.readFileSync(path.join(__dirname, "target/idl/counter_program.json"), "utf-8")
);

// Program ID — тот же, что в declare_id! и Anchor.toml
const PROGRAM_ID = new PublicKey("62Hak3ofdbk9XoEKByZ4WSmz5TtFsvHwcz81mRXvkvoh");

async function main() {
  // 1. Подключаемся к Devnet
  const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

  // 2. Загружаем тот же keypair, что используется в Solana CLI (~/.config/solana/id.json)
  const secretKeyPath = path.join(os.homedir(), ".config", "solana", "id.json");
  const secretKey = Uint8Array.from(JSON.parse(fs.readFileSync(secretKeyPath, "utf-8")));
  const walletKeypair = Keypair.fromSecretKey(secretKey);

  console.log("Кошелёк:", walletKeypair.publicKey.toBase58());

  // 3. Создаём AnchorProvider (Connection + Wallet)
  const wallet = new Wallet(walletKeypair);
  const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
  anchor.setProvider(provider);

  // 4. Создаём объект Program из IDL
  const program = new Program(idl as any, provider);

  // 5. Вычисляем PDA (Program Derived Address) для счётчика этого пользователя.
  // Это ДЕТЕРМИНИРОВАННЫЙ адрес — он всегда одинаковый для одних и тех же seeds,
  // а не случайная пара ключей.
  const [counterPda, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from("counter"), walletKeypair.publicKey.toBuffer()],
    PROGRAM_ID
  );
  console.log("Counter PDA:", counterPda.toBase58(), "bump:", bump);

  // 6. Проверяем, существует ли уже счётчик (если скрипт запускали раньше)
  let existing = null;
  try {
    existing = await (program.account as any).counter.fetch(counterPda);
  } catch {
    existing = null;
  }

  if (!existing) {
    console.log("\n--- Вызываем initialize ---");
    const tx = await program.methods
      .initialize()
      .accounts({
        counter: counterPda,
        authority: walletKeypair.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();
    console.log("Транзакция initialize:", tx);
  } else {
    console.log("\nСчётчик уже существует, initialize пропускаем.");
  }

  // 7. Увеличиваем счётчик дважды
  for (let i = 0; i < 2; i++) {
    console.log(`\n--- Вызываем increment (${i + 1}) ---`);
    const tx = await program.methods
      .increment()
      .accounts({
        counter: counterPda,
        authority: walletKeypair.publicKey,
      })
      .rpc();
    console.log("Транзакция increment:", tx);
  }

  // 8. Уменьшаем счётчик один раз
  console.log("\n--- Вызываем decrement ---");
  const decTx = await program.methods
    .decrement()
    .accounts({
      counter: counterPda,
      authority: walletKeypair.publicKey,
    })
    .rpc();
  console.log("Транзакция decrement:", decTx);

  // 9. Читаем финальное состояние счётчика напрямую с блокчейна
  const counterAccount = await (program.account as any).counter.fetch(counterPda);
  console.log("\n=== Финальное состояние счётчика ===");
  console.log("count:", counterAccount.count.toString());
  console.log("authority:", counterAccount.authority.toBase58());
}

main().catch((err) => {
  console.error("Ошибка:", err);
  process.exit(1);
});
