/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/shield_chat.json`.
 */
export type ShieldChat = {
  "address": "FVViRGPShMjCeSF3LDrp2qDjp6anRz9WAMiJrsGCRUzN",
  "metadata": {
    "name": "shieldChat",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Private messaging on Solana"
  },
  "instructions": [
    {
      "name": "createChannel",
      "docs": [
        "Create a new encrypted channel",
        "Metadata is encrypted via Arcium client-side"
      ],
      "discriminator": [
        37,
        105,
        253,
        99,
        87,
        46,
        223,
        20
      ],
      "accounts": [
        {
          "name": "channel",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  104,
                  97,
                  110,
                  110,
                  101,
                  108
                ]
              },
              {
                "kind": "account",
                "path": "owner"
              },
              {
                "kind": "arg",
                "path": "channelId"
              }
            ]
          }
        },
        {
          "name": "owner",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "channelId",
          "type": "u64"
        },
        {
          "name": "encryptedMetadata",
          "type": "bytes"
        },
        {
          "name": "channelType",
          "type": {
            "defined": {
              "name": "channelType"
            }
          }
        }
      ]
    },
    {
      "name": "joinChannel",
      "docs": [
        "Add member to channel with optional token-gating"
      ],
      "discriminator": [
        124,
        39,
        115,
        89,
        217,
        26,
        38,
        29
      ],
      "accounts": [
        {
          "name": "channel",
          "writable": true
        },
        {
          "name": "member",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  101,
                  109,
                  98,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "channel"
              },
              {
                "kind": "account",
                "path": "memberWallet"
              }
            ]
          }
        },
        {
          "name": "memberWallet",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "leaveChannel",
      "docs": [
        "Leave channel (member removes themselves)"
      ],
      "discriminator": [
        104,
        0,
        75,
        134,
        95,
        80,
        68,
        186
      ],
      "accounts": [
        {
          "name": "channel",
          "writable": true
        },
        {
          "name": "member",
          "writable": true
        },
        {
          "name": "memberWallet",
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "logMessage",
      "docs": [
        "Log message hash on-chain (actual message stored off-chain)",
        "This provides proof of message without revealing content"
      ],
      "discriminator": [
        148,
        4,
        44,
        34,
        202,
        5,
        83,
        115
      ],
      "accounts": [
        {
          "name": "channel",
          "writable": true
        },
        {
          "name": "member"
        },
        {
          "name": "sender",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "messageHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "encryptedIpfsCid",
          "type": "bytes"
        }
      ]
    },
    {
      "name": "setTokenGate",
      "docs": [
        "Set token-gating requirements (owner only)"
      ],
      "discriminator": [
        181,
        246,
        120,
        133,
        255,
        105,
        150,
        113
      ],
      "accounts": [
        {
          "name": "channel",
          "writable": true
        },
        {
          "name": "owner",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "requiredTokenMint",
          "type": "pubkey"
        },
        {
          "name": "minTokenAmount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "updateChannel",
      "docs": [
        "Update channel settings (owner only)"
      ],
      "discriminator": [
        75,
        204,
        94,
        165,
        60,
        180,
        193,
        217
      ],
      "accounts": [
        {
          "name": "channel",
          "writable": true
        },
        {
          "name": "owner",
          "signer": true
        }
      ],
      "args": [
        {
          "name": "newEncryptedMetadata",
          "type": {
            "option": "bytes"
          }
        },
        {
          "name": "newIsActive",
          "type": {
            "option": "bool"
          }
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "channel",
      "discriminator": [
        49,
        159,
        99,
        106,
        220,
        87,
        219,
        88
      ]
    },
    {
      "name": "member",
      "discriminator": [
        54,
        19,
        162,
        21,
        29,
        166,
        17,
        198
      ]
    }
  ],
  "events": [
    {
      "name": "messageLogged",
      "discriminator": [
        24,
        236,
        247,
        207,
        227,
        70,
        101,
        210
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "metadataTooLarge",
      "msg": "Metadata size exceeds maximum allowed"
    },
    {
      "code": 6001,
      "name": "channelFull",
      "msg": "Channel has reached maximum member capacity"
    },
    {
      "code": 6002,
      "name": "channelInactive",
      "msg": "Channel is not active"
    },
    {
      "code": 6003,
      "name": "insufficientTokens",
      "msg": "Insufficient token balance for channel access"
    },
    {
      "code": 6004,
      "name": "notChannelMember",
      "msg": "Sender is not a member of this channel"
    },
    {
      "code": 6005,
      "name": "memberNotActive",
      "msg": "Member is not active"
    },
    {
      "code": 6006,
      "name": "notChannelOwner",
      "msg": "Only channel owner can perform this action"
    },
    {
      "code": 6007,
      "name": "unauthorizedSender",
      "msg": "Unauthorized sender"
    }
  ],
  "types": [
    {
      "name": "channel",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "channelId",
            "type": "u64"
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "encryptedMetadata",
            "type": "bytes"
          },
          {
            "name": "channelType",
            "type": {
              "defined": {
                "name": "channelType"
              }
            }
          },
          {
            "name": "memberCount",
            "type": "u16"
          },
          {
            "name": "messageCount",
            "type": "u64"
          },
          {
            "name": "createdAt",
            "type": "i64"
          },
          {
            "name": "isActive",
            "type": "bool"
          },
          {
            "name": "requiredTokenMint",
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "minTokenAmount",
            "type": {
              "option": "u64"
            }
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "channelType",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "directMessage"
          },
          {
            "name": "privateGroup"
          },
          {
            "name": "tokenGated"
          },
          {
            "name": "public"
          }
        ]
      }
    },
    {
      "name": "member",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "channel",
            "type": "pubkey"
          },
          {
            "name": "wallet",
            "type": "pubkey"
          },
          {
            "name": "joinedAt",
            "type": "i64"
          },
          {
            "name": "isActive",
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "messageLogged",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "channel",
            "type": "pubkey"
          },
          {
            "name": "sender",
            "type": "pubkey"
          },
          {
            "name": "messageHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "encryptedIpfsCid",
            "type": "bytes"
          },
          {
            "name": "messageNumber",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    }
  ]
};
