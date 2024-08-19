import { Api, TonApiClient } from "@ton-api/client";
import { Address, beginCell, internal, toNano, SendMode, external, storeMessage } from "@ton/core";
import { mnemonicToPrivateKey } from "@ton/crypto";
import { ContractAdapter } from "@ton-api/ton-adapter";
import { getHttpEndpoint } from "@orbs-network/ton-access";

// Setup API client
const endpoint = await getHttpEndpoint({ network: "testnet" });
const http = new TonApiClient({ baseUrl: endpoint });
const client = new Api(http);
const provider = new ContractAdapter(client);

export const gasFee = async () => {
  const mnemonicPool =process.env.KEY;

  const userWalletAddress = Address.parse("user_wallet_address_here"); // Replace with the user wallet address
  const poolWalletAddress = Address.parse("pool_wallet_address_here"); // Replace with the pool wallet address

  const transferAmount = toNano(0.6); // 0.6 TON in nanoton

  // Load the pool wallet key pair and contract
  const keyPairPool = await mnemonicToPrivateKey(mnemonicPool.split(" "));
  const walletPool = WalletContractV5R1.create({ workChain: 0, publicKey: keyPairPool.publicKey });
  const contractPool = provider.open(walletPool);

  console.log("Pool wallet address (for transfer and gas):", walletPool.address.toString(), await contractPool.getBalance());

  // Create transfer payload from pool to user
  const transferPayload = beginCell()
    .storeUint(0x3d6508c4, 32) // Transfer operation code (dummy example, replace with actual code)
    .storeUint(0, 64) // Timestamp or similar field
    .storeCoins(transferAmount) // Amount to transfer
    .storeAddress(userWalletAddress) // User’s wallet address
    .storeBit(false) // Optional custom payload
    .endCell();

  const messageToEstimate = beginCell()
    .storeWritable(
      storeMessage(
        internal({
          to: userWalletAddress,
          bounce: false,
          value: toNano(0.05), // Amount for gas, adjust as necessary
          body: transferPayload,
        })
      )
    )
    .endCell();

  // Estimate gas costs
  const params = await client.gasless.gaslessEstimate(poolWalletAddress, {
    walletAddress: walletPool.address,
    walletPublicKey: keyPairPool.publicKey.toString("hex"),
    messages: [{ boc: messageToEstimate }],
  });

  console.log("Estimated transfer:", params);

  const seqnoPool = await contractPool.getSeqno();

  // Prepare and send the transfer from Pool wallet
  const transferForSend = walletPool.createTransfer({
    seqno: seqnoPool,
    authType: "internal",
    timeout: Math.ceil(Date.now() / 1000) + 5 * 60,
    secretKey: keyPairPool.secretKey,
    sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
    messages: params.messages.map((message) =>
      internal({
        to: message.address,
        value: BigInt(message.amount),
        body: message.payload,
      })
    ),
  });

  // External message signed by Pool wallet
  const extMessage = beginCell()
    .storeWritable(
      storeMessage(
        external({
          to: walletPool.address,
          init: seqnoPool === 0 ? walletPool.init : undefined,
          body: transferForSend,
        })
      )
    )
    .endCell();

  // Send the transfer using Pool wallet
  client.gasless
    .gaslessSend({
      walletPublicKey: keyPairPool.publicKey.toString("hex"),
      boc: extMessage,
    })
    .then(() => console.log("Transfer of 0.6 TON from Pool wallet to User wallet successfully sent!"))
    .catch((err) => console.error("Error sending transfer:", err));
};

