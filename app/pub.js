a = {
    "private": {
        "wif": "KyfpUWLkDJDCSNCoexJoym2ruarbqJz7tT1DgeuhCfieBZiTdd1V",
        "hexa": "491b20fd7e0ac03e5845f44c4741e4fae7d5f1817dfd34b3b8f92aae8f7df917",
        "adress": {
            "x": "0b127569cb431bfb6c90b482a265e9a4bdecb26d7160b49e7d9e63057ad4d5be",
            "y": "48b37c2c299a2b8b8e2d84364ba7cf7b20e09f85189c648ffd5daf8f5e389e3f",
            "compressed": true
        }
    },
    "public": {
        "address": "12Nk5Asjn8DVqHHYEC6kMyzSFR2VxF7XLr"
    }
}

let privateKey = new bitcore.PrivateKey();
let publicKey = privateKey.toAddress();

res.send({
    private: {
        wif: privateKey.toWIF(),
        hexa: privateKey.toString(),
        adress: privateKey.toPublicKey(),
    },
    public: {
        address: publicKey.toString(),
    }
})


var value = new Buffer.from('siavash yonesi bitbaz react');
var hash = bitcore.crypto.Hash.sha256(value);
var bn = bitcore.crypto.BN.fromBuffer(hash);

var hdPrivateKey = new bitcore.HDPrivateKey('xprv9s21ZrQH143K3QTDL4LXw2F7HEK3wJUD2nW2nRk4stbPy6cq3jPPqjiChkVvvNKmPGJxWUtg6LnF5kejMRNNU3TGtRBeJgk33yuGBxrMPHi');
var hdPublicKey = hdPrivateKey.hdPublicKey;

var address = new bitcore.Address(hdPublicKey.publicKey);
console.log(address);
console.log('------');
for (let i = 0; i < 10; i++) {
    let derivedAddress = new bitcore.Address(hdPublicKey.derive(i).publicKey);

    console.log(derivedAddress);
}




let privateKey = new bitcore.PrivateKey(bn);

// let publicKey = privateKey.toAddress();

res.send({
    private: {
        wif: privateKey.toWIF(),
        hexa: privateKey.toString(),
        adress: privateKey.toPublicKey(),
    },
    public: {
        address1: privateKey.toAddress().toString(),
    }
})

