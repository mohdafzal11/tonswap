import { Api, TonApiClient } from "@ton-api/client";
import { WalletContractV4, internal, TonClient } from "@ton/ton";
import { Address, toNano, SendMode } from "@ton/core";
import { mnemonicToPrivateKey } from "@ton/crypto";
import { ContractAdapter } from "@ton-api/ton-adapter";

// const endpoint = await getHttpEndpoint({ network: "testnet" });
const client = new TonClient({
  endpoint: "https://testnet.toncenter.com/api/v2/jsonRPC",
  apiKey: "4aaa9ba4d04b1f5d88245bcecef4d0723f36ba95b225e4c5a1c1351e55dd53ce",
});

const provider = new ContractAdapter(client);

export const gasFee = async () => {
  try {
    const mnemonic =
      "drama cabin police benefit need filter trial easily physical immense sudden entire worth child illness adjust narrow farm keep duty wolf ankle actual hockey";
    const destination = Address.parse(
      "0QDZCwEV1RTaskFt1c1VJg1EP36jejpxyd8l0WSX0wI9Zz4p"
    );

    const keyPair = await mnemonicToPrivateKey(mnemonic.split(" "));
    const workChain = 0;

    const wallet = WalletContractV4.create({
      workchain: workChain,
      publicKey: keyPair.publicKey,
    });

    const contract = client.open(wallet);

    console.log(contract.address);
    console.log(await contract.getBalance());
    const seqno = await contract.getSeqno();

    const params = {
      seqno,
      secretKey: keyPair.secretKey,
      messages: [
        internal({
          to: "0QDZCwEV1RTaskFt1c1VJg1EP36jejpxyd8l0WSX0wI9Zz4p",
          value: "1",
          body: "Example transfer body",
        }),
      ],
    };

    const txn = contract.createTransfer(params);

    console.log(txn);
    const tetherTransferForSend = await contract.sendTransfer(params);

    console.log("A gasless transfer sent!", tetherTransferForSend);
  } catch (error) {
    console.error("An error occurred:", error);
    console.log(error.body);
    if (error instanceof RangeError) {
      console.error("A RangeError occurred:", error);
    }
  }
};

async function printConfigAndReturnRelayAddress() {
  const cfg = await client.gasless.gaslessConfig();

  console.log("Available jettons for gasless transfer");
  console.log(cfg.gasJettons.map((gasJetton) => gasJetton.masterId));

  console.log(`Relay address to send fees to: ${cfg.relayAddress}`);
  return cfg.relayAddress;
}
