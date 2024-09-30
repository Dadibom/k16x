const registers = ['x0', 'x1', 'x2', 'x3', 'x4', 'x5', 'x6', 'x7', 'sp', 'pc'];
const microInstructionDef = {
    RegASelect: {
        index: 0,
        bits: 3,
        values: {
            x0: 0,
            x1: 1,
            x2: 2,
            x3: 3,
            x4: 4,
            x5: 5,
            x6: 6,
            sp: 6,
            x7: 7,
            pc: 7,
        },
    },
    RegBSelect: {
        index: 3,
        bits: 3,
        values: {
            x0: 0,
            x1: 1,
            x2: 2,
            x3: 3,
            x4: 4,
            x5: 5,
            x6: 6,
            sp: 6,
            x7: 7,
            pc: 7,
        },
    },
    ALUOp: {
        index: 6,
        bits: 4,
        values: {
            add: 0,
            sub: 1,
        }
    },
    WriteSelect: {
        index: 10,
        bits: 2,
        values: {
            None: 0,
            MEM_RegAOut: 1,
            MEM_IMM: 2,
            MEM_ALUOut: 3,

            REG_IoBus: 4,
            REG_RegBOut: 5,
            REG_IMM: 6,
            REG_ALUOut: 7,
        },
    },
    IOAddrSelect: {
        index: 15,
        bits: 1,
        values: {
            RegBOut: 0,
            IMM: 1,
        }
    },
};

function microInstructionToByteCode(mi) {
    let code = 0;
    // Validate microinstruction
    for (const key in mi) {
        const def = microInstructionDef[key];
        if (!def) {
            throw new Error(`Invalid microinstruction key: ${key}`);
        }

        if (!mi[key] in def.values) {
            throw new Error(`Invalid value for ${key}: ${mi[key]}`);
        }

        const value = def.values[mi[key]];
        if (value >= 1 << def.bits) {
            throw new Error(`Value too large for ${key}: ${mi[key]}`);
        }
        code |= value << def.index;
    }

    return code;
}

// move x0, [123]
function loadMemAtImm(reg, addr) {
    return [
        microInstructionToByteCode({
            RegASelect: reg,
            IOAddrSelect: 'IMM',
            WriteSelect: 'REG_IoBus',
        }),
        addr
    ];
}
// move [123], x0
function storeMemAtImm(reg, addr) {
    return [
        microInstructionToByteCode({
            RegASelect: reg,
            IOAddrSelect: 'IMM',
            WriteSelect: 'IO_RegAOut',
        }),
        addr
    ];
}
// move x0, [x1]
function loadMemAtReg(dataReg, addrReg) {
    return [
        microInstructionToByteCode({
            RegASelect: dataReg,
            RegBSelect: addrReg,
            IOAddrSelect: 'RegBOut',
            WriteSelect: 'REG_IoBus',
        })
    ];
}
// move [x1], x0
function storeMemAtReg(dataReg, addrReg) {
    return [
        microInstructionToByteCode({
            RegASelect: dataReg,
            RegBSelect: addrReg,
            IOAddrSelect: 'RegBOut',
            WriteSelect: 'IO_RegAOut',
        })
    ];
}
