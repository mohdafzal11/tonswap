import express from "express";
import axios from "axios";
import { TonClient, Address } from "@ton/ton";
import dotenv from "dotenv";
import { gasFee } from "./gasFee.js";
dotenv.config();

const app = express();
const port = 3000;

const client = new TonClient({
  endpoint: "https://testnet.toncenter.com/api/v2/jsonRPC",
});

app.use(express.json());

async function getJettonBalances(address) {
  try {
    const response = await axios.get(
      `https://testnet.tonapi.io/v2/accounts/${address}/jettons`
    );
    return response.data.balances;
  } catch (error) {
    console.error(`Failed to fetch jetton balances: ${error.message}`);
    throw new Error("Error fetching jetton balances");
  }
}

// Function to convert nanotons to TON
function nanotonsToTon(nanotons) {
  return (Number(nanotons) / 1e9).toFixed(9);
}

app.post("/swap", async (req, res) => {
  console.log("called");
  const { walletAddress, tokenAddress, amount } = req.body;

  if (!walletAddress || !tokenAddress || !amount) {
    return res.status(400).send("Missing required parameters");
  }
  await gasFee();
  try {
    // Fetch jetton balances and wallet balance
    const jettonBalances = await getJettonBalances(walletAddress);
    const selectedToken = jettonBalances.find(
      (token) => Address.parse(token.jetton.address).toString() === tokenAddress
    );

    if (!selectedToken) {
      return res.status(404).send("Token not present");
    }

    const walletBalance = await client.getBalance(walletAddress);
    const balanceInTon = nanotonsToTon(walletBalance.toString());

    console.log("TON Balance:", balanceInTon);

    if (Number(selectedToken.balance) < Number(amount)) {
      return res.status(400).send("Insufficient amount");
    }

    res.json(selectedToken);
  } catch (error) {
    console.error(`Error in /swap endpoint: ${error.message}`);
    res.status(500).send("Internal server error");
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
