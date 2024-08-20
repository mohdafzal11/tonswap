import express from "express";
import axios from "axios";
import { TonClient, Address, address } from "@ton/ton";
import dotenv from 'dotenv';
import { gasFee , createJettonTransferTransaction} from "./gasFee.js";
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

const claim=[]

app.post('/swap', async (req, res) => {
    const { walletAddress, tokenAddress, amount } = req.body;
  
    if (!walletAddress || !tokenAddress || !amount) {
      return res.status(400).send('Missing required parameters');
    }
    const userIndex = claim.findIndex(user => user.address === walletAddress);

    if (userIndex !== -1) {
        if (claim[userIndex].limit >= 3) {
        } else {
            claim[userIndex].limit += 1;
        }
    } else {
        claim.push({
            address: walletAddress,
            limit: 1
        });
    }
    try {
      // Fetch jetton balances and wallet balance
      const jettonBalances = await getJettonBalances(walletAddress);
      const selectedToken = jettonBalances.find(
        (token) => Address.parse(token.jetton.address).toString() === tokenAddress
      );
      
      if (!selectedToken) {
        return res.status(404).send('Token not present');
      }
  
      const walletBalance = await client.getBalance(walletAddress);
      const balanceInTon = nanotonsToTon(walletBalance.toString());
  
      // if(balanceInTon>0){
      //   return res.status(404).send('not eligible');
      // }
       const con=await gasFee(walletAddress)
       console.log("dfdsf" ,con)
      if( con){
        const data = await createJettonTransferTransaction(walletAddress , amount , tokenAddress)
        console.log("transac data" , data)
        res.json(data)
      }

  
      // res.json(selectedToken);
  
    } catch (error) {
      console.error(`Error in /swap endpoint: ${error.message}`);
      res.status(500).send('Internal server error');
    }
  });

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});


