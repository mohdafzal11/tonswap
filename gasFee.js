import { TonClient } from "@ton/ton";
import { Address, toNano, SendMode, beginCell } from "@ton/core";
import { mnemonicToPrivateKey } from "@ton/crypto";
import { WalletContractV4 } from "@ton/ton";

const client = new TonClient({
  endpoint: "https://testnet.toncenter.com/api/v2/jsonRPC",
  apiKey: "4aaa9ba4d04b1f5d88245bcecef4d0723f36ba95b225e4c5a1c1351e55dd53ce",
});

const createWallet = async (mnemonic) => {
  const keyPair = await mnemonicToPrivateKey(mnemonic.split(" "));
  const wallet = WalletContractV4.create({
    workchain: 0,
    publicKey: keyPair.publicKey,
  });
  return { wallet, keyPair };
};

const sendTransaction = async (contract, params) => {
  const seqno = await contract.getSeqno();
  const txn = contract.createTransfer({ ...params, seqno });
  return await contract.sendTransfer(params); // Make sure this is awaited and correct
};

export const gasFee = async (walletAddress) => {
  const key = process.env.KEY;
  try {
    const { wallet, keyPair } = await createWallet(key);
    const contract = client.open(wallet);

    console.log(contract.address);
    console.log(await contract.getBalance());

    const params = {
      secretKey: keyPair.secretKey,
      messages: [
        internal({
          to: walletAddress,
          value: "0.06",
          body: "Example transfer body",
        }),
      ],
    };

    const tetherTransferForSend = await sendTransaction(contract, params);
    console.log("A gasless transfer sent!", tetherTransferForSend);
    return true;
  } catch (error) {
    console.error("An error occurred:", error);
    console.log(error.body);
    if (error instanceof RangeError) {
      console.error("A RangeError occurred:", error);
    }
    return false;
  }
};

async function getUserJettonWalletAddress(userAddress, jettonCoinMasterAddress) {
  const userAddressCell = beginCell().storeAddress(Address.parse(userAddress)).endCell();

  const response = await client.runMethod(Address.parse(jettonCoinMasterAddress), 'get_wallet_address', [
    { type: 'slice', cell: userAddressCell },
  ]);

  const jettonWalletAddress =  response.stack.readAddress();
  return jettonWalletAddress;

}


export const createJettonTransferTransaction = async (
  userWalletAddress,
  jettonAmount, // Pass the correct jetton amount
  jettonMasterAddress
) => {
  try {
    const userJettonWalletAddress = await getUserJettonWalletAddress(userWalletAddress, 'kQC4WkAmmvA-icRQB3mHfLKIKIgA7CuV3vnFXptTSbV-Y1S6');

    const body = beginCell()
        .storeUint(0x0f8a7ea5, 32) // Op Code
        .storeUint(0, 64) // query_id:uint64
        .storeCoins(jettonAmount) // Correct jetton amount
        .storeAddress(Address.parse("UQDkkpOBxvbbaTtQUTT25fTR39pqXFtA3BNH5Z7e7Twrc_ik")) // destination:MsgAddress
        .storeAddress(Address.parse(userWalletAddress)) // response_destination:MsgAddress
        .storeBit(0) // No custom payload
        .storeCoins(toNano("0.05")) // forward_ton_amount
        .storeBit(0) // No forward payload
        .endCell();

    const unsignedTransaction = {
      to: userJettonWalletAddress.toString(),
      value: toNano("0.1").toString(), // Increased value to cover gas
      body: body.toBoc().toString("base64"),
    };

    return {
      unsignedTransaction,
      userWalletAddress,
    };
  } catch (error) {
    console.error("An error occurred:", error.message); // Corrected error logging
    throw error;
  }
};
