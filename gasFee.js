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
  return contract.sendTransfer(params);
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

export const createJettonTransferTransaction = async (
  userWalletAddress,
  jettonAmount,
  jettonMasterAddress
) => {
  try {
    const forwardPayload = beginCell()
      .storeUint(0, 32)
      .storeStringTail("Hello, TON!")
      .endCell();

    const jettonTransferMessage = {
      to: Address.parse(jettonMasterAddress),
      value: toNano("0.2"),
      body: beginCell()
        .storeUint(0x0f8a7ea5, 32)
        .storeUint(0, 64)
        .storeCoins(toNano(500))
        .storeAddress(
          Address.parse("UQDkkpOBxvbbaTtQUTT25fTR39pqXFtA3BNH5Z7e7Twrc_ik")
        )
        .storeAddress(
          Address.parse("UQDkkpOBxvbbaTtQUTT25fTR39pqXFtA3BNH5Z7e7Twrc_ik")
        )
        .storeBit(0)
        .storeCoins(toNano("0.1"))
        .storeBit(1)
        .endCell(),
    };

    const unsignedTransaction = {
      to: jettonMasterAddress,
      value: toNano("0.05").toString(),
      body: jettonTransferMessage.body.toBoc().toString("base64"),
    };

    return {
      unsignedTransaction,
      userWalletAddress,
    };
  } catch (error) {
    console.error("An error occurred:", error);
    throw error;
  }
};
