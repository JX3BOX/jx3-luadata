---
title: 剑网3缘起本地序列化lua数据说明
tags: 
notebook: 工作文档
---

## 剑网3缘起本地序列化lua数据说明

## 说明

我们观察到插件有一些把数据输出存储到本地的行为
这个行为调用了我们官方的序列化输出接口，比如把战斗数据的luatable表输出到一个本地文件，还有DBM的分享数据
我们官方以前提供的接口是输出成lua代码的明文字符串，效率很低，会造成很明显的客户端失去响应
所以我们做了一个新的二进制格式。测试显示效率提升20倍以上，
但是我们观察到魔盒的网站上会对这些数据做解析和让玩家做二次修改
新格式由于不是明文的，可能会导致你们的这些功能失效

## 基本结构

兼容用的文件头
二进制数据

### 文件格式：

```lua
    struct VAR_2_BINARY_SAVE_DATA // 文件头
    {
        VAR_2_BINARY_HEADER Header;
        BYTE                byContent[0]; // 二进制内容
    };

```

### 文件头:

```lua
    // 头部说明
    #define VAR_2_BINARY_MAGIC      (0x206174614461754C) // "LuaData "
    #define VAR_2_BINARY_VERSION    (2)
    
    struct VAR_2_BINARY_HEADER
    {
        uint64_t        ulMagic        = VAR_2_BINARY_MAGIC;
        int             nVersion    = VAR_2_BINARY_VERSION;
        BYTE            byCompress    = 0;    // 是否压缩(预留)
        BYTE            byCheckCRC    = 0;    // 是否校验CRC(预留)
        unsigned int    uCRCCode    = 0;    // (预留)
    };

```

为了兼容老格式，在文件头放了一个8自己的识别码
如果发下开头的是 "LuaData "(0x206174614461754C) 则说明是二进制格式
否则可以继续按照老格式来解析

### 二进制部分的序列化和反序列化C代码：

```C++
函数入口说明：
// 对Lua的参数打包进内存缓冲区,以方便传输和存储
// 返回打包参数存放之后的地址,出错则返回NULL
BYTE* LuaPackup(Lua_State* L, int nIndex, BYTE* pbyBufer, size_t uBufferSize);

// 将缓冲区存储的打包数据解包进Lua堆栈
// 每次调用只解包一个参数
// 返回值表示下一个参数的起始地址,出错则返回NULL
BYTE* LuaUnpack(Lua_State* L, BYTE* pbyData, size_t uDataLen);
```

```C++
KLuaValueDef // 类型定义
{
    eLuaPackNumber,
    eLuaPackBoolean,
    eLuaPackString,
    eLuaPackNill,
    eLuaPackTable,
};

BYTE* LuaPackupNumber(BYTE* pbyBuffer, size_t uBufferSize, double fValue)
{
    BYTE* pbyResult = NULL;

    KGLOG_PROCESS_ERROR(uBufferSize >= 1);
    *pbyBuffer = eLuaPackNumber;
    pbyBuffer++;
    uBufferSize--;

    KGLOG_PROCESS_ERROR(uBufferSize >= sizeof(double));
    *(double*)pbyBuffer = fValue;
    pbyBuffer   += sizeof(double);
    uBufferSize -= sizeof(double);

    pbyResult = pbyBuffer;
Exit0:
    return pbyResult;
}

BYTE* LuaPackupBoolean(BYTE* pbyBuffer, size_t uBufferSize, BOOL bValue)
{
    BYTE* pbyResult = NULL;

    KGLOG_PROCESS_ERROR(uBufferSize >= 1);
    *pbyBuffer = eLuaPackBoolean;
    pbyBuffer++;
    uBufferSize--;

    KGLOG_PROCESS_ERROR(uBufferSize >= sizeof(bool));
    *(bool*)pbyBuffer = (bool)bValue;
    pbyBuffer   += sizeof(bool);
    uBufferSize -= sizeof(bool);

    pbyResult = pbyBuffer;
Exit0:
    return pbyResult;
}

BYTE* LuaPackupString(BYTE* pbyBuffer, size_t uBufferSize, const char cszValue[])
{
    BYTE*   pbyResult = NULL;
    size_t  uStrLen   = 0;

    assert(cszValue);

    KGLOG_PROCESS_ERROR(uBufferSize >= 1);
    *pbyBuffer = eLuaPackString;
    pbyBuffer++;
    uBufferSize--;

    uStrLen = strlen(cszValue) + 1;

    KGLOG_PROCESS_ERROR(uBufferSize >= uStrLen);
    memcpy(pbyBuffer, cszValue, uStrLen);
    pbyBuffer   += uStrLen;
    uBufferSize -= uStrLen;

    pbyResult = pbyBuffer;
Exit0:
    return pbyResult;
}

BYTE* LuaPackupNill(BYTE* pbyBuffer, size_t uBufferSize)
{
    BYTE* pbyResult = NULL;

    KGLOG_PROCESS_ERROR(uBufferSize >= 1);
    *pbyBuffer = eLuaPackNill;
    pbyBuffer++;
    uBufferSize--;

    pbyResult = pbyBuffer;
Exit0:
    return pbyResult;
}

BYTE* LuaPackage_NewTable(BYTE* pbyBuffer, size_t uBufferSize)
{
    BYTE* pbyResult = NULL;

    KGLOG_PROCESS_ERROR(uBufferSize >= 1);
    *pbyBuffer = eLuaPackTable;
    pbyBuffer++;
    uBufferSize--;

    KGLOG_PROCESS_ERROR(uBufferSize >= sizeof(DWORD));
    *(DWORD*)pbyBuffer = 0;
    pbyBuffer   += sizeof(DWORD);
    uBufferSize -= sizeof(DWORD);

    pbyResult = pbyBuffer;
Exit0:
    return pbyResult;
}

BYTE* LuaPackage_SetTable(BYTE* pbyTable, BYTE* pbyTail)
{
    BYTE* pbyResult = NULL;
    BYTE* pbyType   = pbyTable - sizeof(DWORD) - sizeof(BYTE);
    BYTE* pbyLength = pbyTable - sizeof(DWORD);

    KGLOG_PROCESS_ERROR(*pbyType == eLuaPackTable);

    *(DWORD*)pbyLength = (DWORD)(pbyTail - pbyTable);

    pbyResult = pbyTail;
Exit0:
    return pbyResult;
}

static BYTE* PackupTable(Lua_State* L, int nIndex, BYTE* pbyBufer, size_t uBufferSize);
static BOOL  UnpackTable(Lua_State* L, BYTE* pbyData, size_t uDataLen);

static int g_nCallStack = 0;

size_t GetLuaPackupSize(Lua_State* L, int nIndex)
{
    size_t  nResultSize = 0;
    int     nType = lua_type(L, nIndex);

    g_nCallStack++;

    if (g_nCallStack >= 16)
    {
        // 由于Lua的Table是可以递归定义,子表可以包含父表
        // 这里用于检测这种情况的发生
        KGLogPrintf(KGLOG_ERR, "GetLuaPackupSize values up to limit: %d", g_nCallStack);
        goto Exit0;
    }


    nResultSize += sizeof(BYTE);
    switch (nType)
    {
    case LUA_TNUMBER:
        nResultSize += sizeof(double);
        break;

    case LUA_TBOOLEAN:
        nResultSize += sizeof(bool);
        break;
    case LUA_TSTRING:
        {
            const char* pszValue = Lua_ValueToString(L, nIndex);
            KGLOG_PROCESS_ERROR(pszValue);

            nResultSize += strlen(pszValue) + 1;
        }
        break;
    case LUA_TNIL:
        break;

    case LUA_TTABLE:
        nResultSize += sizeof(DWORD); // length

        if (nIndex < 0)
            --nIndex;

        Lua_PushNil(L);
        while (Lua_Next(L, nIndex))
        {
            nResultSize += GetLuaPackupSize(L, -2);
            nResultSize += GetLuaPackupSize(L, -1);

            Lua_Pop(L, 1);
        }

        break;

    default:
        KGLogPrintf(KGLOG_ERR, "[Lua] Unsupported value type: %d", nType);
        break;
    }

Exit0:
    g_nCallStack--;
    return nResultSize;
}

BYTE* LuaPackup(Lua_State* L, int nIndex, BYTE* pbyBufer, size_t uBufferSize)
{
    BYTE*   pbyResult   = NULL;
    int     nType       = lua_type(L, nIndex);

    g_nCallStack++;

    if (g_nCallStack >= 16)
    {
        // 由于Lua的Table是可以递归定义,子表可以包含父表
        // 这里用于检测这种情况的发生
        KGLogPrintf(KGLOG_ERR, "LuaPackup values up to limit: %d", g_nCallStack);
        goto Exit0;
    }

    switch (nType)
    {
    case LUA_TNUMBER:
        {
            double fValue = Lua_ValueToNumber(L, nIndex);

            pbyResult = LuaPackupNumber(pbyBufer, uBufferSize, fValue);
        }
        break;

    case LUA_TBOOLEAN:
        {
            BOOL bValue = Lua_ValueToBoolean(L, nIndex);

            pbyResult = LuaPackupBoolean(pbyBufer, uBufferSize, bValue);
        }
        break;

    case LUA_TSTRING:
        {
            const char* pszValue = Lua_ValueToString(L, nIndex);
            KGLOG_PROCESS_ERROR(pszValue);
            
            pbyResult = LuaPackupString(pbyBufer, uBufferSize, pszValue);
        }
        break;

    case LUA_TNIL:
        {
            pbyResult = LuaPackupNill(pbyBufer, uBufferSize);
        }
        break;

    case LUA_TTABLE:
        {
            pbyResult = PackupTable(L, nIndex, pbyBufer, uBufferSize);
        }
        break;

    default:
        KGLogPrintf(KGLOG_ERR, "[Lua] Unsupported value type: %d", nType);
        break;
    }

Exit0:
    g_nCallStack--;
    return pbyResult;
}

static BYTE* PackupTable(Lua_State* L, int nIndex, BYTE* pbyBufer, size_t uBufferSize)
{
    BYTE*   pbyResult  = NULL;
    BYTE*   pbyTable   = NULL;
    BYTE*   pbyTail    = pbyBufer + uBufferSize;

    assert(lua_istable(L, nIndex));

    // PushNil后,要保持nIndex仍然正确的指向的话
    // 绝对索引自然是正确的,如果是相对索引的话,则要修正
    if (nIndex < 0)
    {
        nIndex--;
    }

    pbyTable = LuaPackage_NewTable(pbyBufer, uBufferSize);
    KGLOG_PROCESS_ERROR(pbyTable);

    pbyBufer = pbyTable;
    uBufferSize = (size_t)(pbyTail - pbyBufer);

    Lua_PushNil(L);

    while (Lua_Next(L, nIndex))
    {
        int nTopIndex = Lua_GetTopIndex(L);

        pbyBufer = LuaPackup(L, nTopIndex - 1, pbyBufer, uBufferSize);
        KGLOG_PROCESS_ERROR(pbyBufer);

        uBufferSize = (size_t)(pbyTail - pbyBufer);

        pbyBufer = LuaPackup(L, nTopIndex, pbyBufer, uBufferSize);
        KGLOG_PROCESS_ERROR(pbyBufer);

        pbyBufer = LuaPackage_SetTable(pbyTable, pbyBufer);
        KGLOG_PROCESS_ERROR(pbyBufer);

        uBufferSize = (size_t)(pbyTail - pbyBufer);

        Lua_Pop(L, 1);
    }

    pbyResult = pbyBufer;
Exit0:
    return pbyResult;
}

BYTE* LuaUnpack(Lua_State* L, BYTE* pbyData, size_t uDataLen)
{
    BYTE*   pbyResult   = NULL;
    BOOL    bRetCode    = false;
    BYTE*   pbyTail     = pbyData + uDataLen;
    int     nType       = 0;

    KGLOG_PROCESS_ERROR(uDataLen >= sizeof(BYTE));
    nType = *pbyData;
    pbyData++;
    uDataLen--;

    switch (nType)
    {
    case eLuaPackNumber:
        {
            double fValue = 0.0f;

            KGLOG_PROCESS_ERROR(uDataLen >= sizeof(double));
            fValue = *(double*)pbyData;
            pbyData += sizeof(double);

            Lua_PushNumber(L, fValue);
        }
        break;

    case eLuaPackBoolean:
        {
            bool bValue = false;

            KGLOG_PROCESS_ERROR(uDataLen >= sizeof(bool));
            bValue = *(bool*)pbyData;
            pbyData += sizeof(bool);

            Lua_PushBoolean(L, bValue);
        }
        break;

    case eLuaPackString:
        {
            const char* pszValue = (char*)pbyData;

            while (pbyData < pbyTail)
            {
                if (*pbyData == '\0')
                    break;

                pbyData++;
            }

            KGLOG_PROCESS_ERROR(pbyData < pbyTail);

            Lua_PushString(L, pszValue);
            pbyData++;
        }
        break;

    case eLuaPackNill:
        Lua_PushNil(L);
        break;

    case eLuaPackTable:
        {
            int     nIndex  = 0;
            DWORD   dwSize  = 0;

            KGLOG_PROCESS_ERROR(uDataLen >= sizeof(DWORD));
            dwSize     = *(DWORD*)pbyData;
            pbyData   += sizeof(DWORD);
            uDataLen  -= sizeof(DWORD);

            KGLOG_PROCESS_ERROR(uDataLen >= dwSize);
            bRetCode = UnpackTable(L, pbyData, dwSize);
            KGLOG_PROCESS_ERROR(bRetCode);
            pbyData += dwSize;
        }
        break;

    default:
        KGLogPrintf(KGLOG_ERR, "[Lua] Unexpected remote param type: %d", nType);
        goto Exit0;
    }

    pbyResult = pbyData;
Exit0:
    return pbyResult;
}

static BOOL UnpackTable(Lua_State* L, BYTE* pbyData, size_t uDataLen)
{
    BOOL  bResult = false;
    BYTE* pbyTail = pbyData + uDataLen;

    Lua_NewTable(L);

    while (pbyData < pbyTail)
    {
        pbyData = LuaUnpack(L, pbyData, (size_t)(pbyTail - pbyData));
        KGLOG_PROCESS_ERROR(pbyData);

        pbyData = LuaUnpack(L, pbyData, (size_t)(pbyTail - pbyData));
        KGLOG_PROCESS_ERROR(pbyData);

        Lua_SetTable(L, -3);
    }

    bResult = true;
Exit0:
    return bResult;
}

```
