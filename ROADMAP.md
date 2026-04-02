### Group chat

1. Circles Avatar group chat
   Circles avatars can create their own group chat without creating a Circles group. It works like usual xmtp group chat, with Circles avatars as group member.

2. Circles group group chat
   1. Create new Circles group and xmtp group -> Backend: store the relationship
   2. Exisiting Circles group owner can create xmtp group chat
   3. Exisitng Circles group members can request to join xmtp group chat
   4. New user can request to join Circles group through group request

Tips:
Check the Circles group membership status of the connected Circles Avatar.

Request

```
curl -X POST 'https://staging.circlesubi.network/' \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"circles_getGroupMemberships","params":["0xF7bD3d83df90B4682725ADf668791D4D1499207f"]}'
```

Response

```
{
  "jsonrpc": "2.0",
  "result": {
    "results": [
      {
        "blockNumber": 0,
        "timestamp": 1772685519,
        "transactionIndex": 0,
        "logIndex": 0,
        "transactionHash": "",
        "group": "0x013d8f8227dce534876bba8b3441cd93a7a241f9",
        "member": "0xf7bd3d83df90b4682725adf668791d4d1499207f",
        "expiryTime": 9223372036854776000
      }
    ],
    "hasMore": false
  },
  "id": 1
}
```

check available group info
Request

```
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "circles_getProfileView",
  "params": [
   // Group address
    "0x1aca75e38263c79d9d4f10df0635cc6fcfe6f026"
  ]
}
```

Response

```
{
  "jsonrpc": "2.0",
  "result": {
    "address": "0x1aca75e38263c79d9d4f10df0635cc6fcfe6f026",
    "avatarInfo": {
      "version": 2,
      "type": "Group",
      "avatar": "0x1aca75e38263c79d9d4f10df0635cc6fcfe6f026",
      "tokenId": "0x1aca75e38263c79d9d4f10df0635cc6fcfe6f026",
      "hasV1": false,
      "cidV0Digest": "",
      "cidV0": "QmPbkxGG1QNHC4Vk1xYexPGTaYYWuhoFirS3QoHhTH8F7W",
      "isHuman": false,
      "name": "Circles Backers",
      "symbol": "CBG"
    },
    "profile": {
      "address": "0x1aca75e38263c79d9d4f10df0635cc6fcfe6f026",
      "name": "Circles Backers",
      "description": "Circles Backers group",
      "previewImageUrl": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnR",
      "shortName": "Znoz4ZQVg8bs",
      "avatarType": "Group"
    },
    "trustStats": {
      "trustsCount": 0,
      "trustedByCount": 0
    },
    "v2Balance": "0"
  },
  "id": 1
}
```
