const registers = ['x0', 'x1', 'x2', 'x3', 'x4', 'x5', 'x6', 'x7', 'sp', 'pc'];
const microInstructionDef = {
    RegASelect: { // Register A select, register input is routed to reg A too
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
    RegBSelect: { // Register B select
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
    ALUOp: { // ALU operation
        index: 6,
        bits: 4,
        values: {
            add: 0,
            sub: 1,
        }
    },
    WriteSelect: { // Write select - where to write data, and from where
        index: 12,
        bits: 3,
        values: {
            None: 0,
            MEM_RegAOut: 1, // Write register A to memory
            MEM_IMM: 2, // Write immediate to memory
            MEM_ALUOut: 3, // Write ALU output to memory @TODO perhaps it won't be fast enough, we could use this value for some other functionality

            REG_IoBus: 4, // Write IO bus to register A
            REG_RegBOut: 5, // Write register B to register A
            REG_IMM: 6, // Write immediate to register A
            REG_ALUOut: 7, // Write ALU output to register A

            /*
            RegASelect: 'pc',
            RegBSelect: 'sp',
            // ALUOp: 0,
            ExtraOp: 'IncSP',
            RegWE: 1,
            MemAddrSelect: 'RegOutB',
            MemInSelect: 'RegOutA',
            RegInSelect: 'Immed',
            */
           // IMM_RA_MEMatB: 8, // xa -> [xb], imm -> [xb]
           /*
           {
                RegASelect: 'pc',
                RegBSelect: 'sp',
                ExtraOp: 'DecSP',
                RegWE: 1,
                MemAddrSelect: 'RegOutB',
                MemInSelect: 'None', // Not used
                RegInSelect: 'MemOut',
            }
            */
           // MEM_RA_MEMatB: 9, // xa -> [xb], [xb] -> [xb]
        },
    },
    IOAddrSelect: { // IO address select
        index: 15,
        bits: 1,
        values: {
            RegBOut: 0,
            IMM: 1,
        }
    },
    ExtraOp: { // Extra operation to perform, e.g., increment stack pointer
        index: 10,
        bits: 2,
        values: {
            None: 0,
            IncrSP: 1,
            DecrSP: 2,
            Invalid: 3,
        }
    }
};

function byteCodeToMicroInstruction(code) {
    const mi = {};
    for (const key in microInstructionDef) {
        const def = microInstructionDef[key];
        const value = (code >> def.index) & ((1 << def.bits) - 1);
        for (const k in def.values) {
            if (def.values[k] === value) {
                mi[key] = k;
                break;
            }
        }
    }
    return mi;
}

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

function getOperandType(operand) {
    if (typeof operand === 'string') {
        if (operand.startsWith('x')) {
            // Register operand, e.g., 'x0'
            return { type: 'reg', value: operand };
        } else if (operand.startsWith('[') && operand.endsWith(']')) {
            const inner = operand.slice(1, -1);
            if (inner.startsWith('x')) {
                // Memory at register address, e.g., '[x1]'
                return { type: 'memReg', value: inner };
            } else if (!isNaN(parseInt(inner))) {
                // Memory at immediate address, e.g., '[123]'
                return { type: 'memImm', value: parseInt(inner) };
            } else {
                throw new Error('Invalid memory operand');
            }
        } else {
            throw new Error('Invalid operand string');
        }
    } else if (typeof operand === 'number') {
        // Immediate value
        return { type: 'imm', value: operand };
    } else {
        throw new Error('Invalid operand type');
    }
}

function move(dest, src) {
    const destOp = getOperandType(dest);
    const srcOp = getOperandType(src);

    // Handle different combinations of destination and source types
    if (destOp.type === 'reg' && srcOp.type === 'reg') {
        // move reg, reg
        return [
            microInstructionToByteCode({
                RegASelect: destOp.value,
                RegBSelect: srcOp.value,
                WriteSelect: 'REG_RegBOut',
            }),
        ];
    } else if (destOp.type === 'reg' && srcOp.type === 'imm') {
        // move reg, imm
        return [
            microInstructionToByteCode({
                RegASelect: destOp.value,
                WriteSelect: 'MEM_IMM',
            }),
            srcOp.value,
        ];
    } else if (destOp.type === 'reg' && srcOp.type === 'memImm') {
        // move reg, [imm]
        return [
            microInstructionToByteCode({
                RegASelect: destOp.value,
                IOAddrSelect: 'IMM',
                WriteSelect: 'REG_IoBus',
            }),
            srcOp.value,
        ];
    } else if (destOp.type === 'reg' && srcOp.type === 'memReg') {
        // move reg, [reg]
        return [
            microInstructionToByteCode({
                RegASelect: destOp.value,
                RegBSelect: srcOp.value,
                IOAddrSelect: 'RegBOut',
                WriteSelect: 'REG_IoBus',
            }),
        ];
    } else if (destOp.type === 'memImm' && srcOp.type === 'reg') {
        // move [imm], reg
        return [
            microInstructionToByteCode({
                RegASelect: srcOp.value,
                IOAddrSelect: 'IMM',
                WriteSelect: 'IO_RegAOut',
            }),
            destOp.value,
        ];
    } else if (destOp.type === 'memReg' && srcOp.type === 'reg') {
        // move [reg], reg
        return [
            microInstructionToByteCode({
                RegASelect: srcOp.value,
                RegBSelect: destOp.value,
                IOAddrSelect: 'RegBOut',
                WriteSelect: 'IO_RegAOut',
            }),
        ];
    } else {
        throw new Error('Invalid move instruction');
    }
}

// push x0 or push 123
function push(dst) {
    const destOp = getOperandType(dst);

    if (destOp.type === 'reg') {
        return [
            microInstructionToByteCode({
                RegASelect: destOp.value,
                WriteSelect: 'MEM_RegAOut',
                ExtraOp: 'IncrSP',
            }),
        ];
    } else if (destOp.type === 'imm') {
        return [
            microInstructionToByteCode({
                WriteSelect: 'MEM_IMM',
                ExtraOp: 'IncrSP',
            }),
            destOp.value,
        ];
    } else {
        throw new Error('Invalid push instruction');
    }
}

// pop x0
function pop(dst) {
    const destOp = getOperandType(dst);

    if (destOp.type === 'reg') {
        return [
            microInstructionToByteCode({
                RegASelect: destOp.value,
                WriteSelect: 'REG_IoBus',
                ExtraOp: 'DecrSP',
            }),
        ];
    } else {
        throw new Error('Invalid pop instruction');
    }
}

// jmp 123 @TODO 32 bit address
function jmp(addr) {
    return [
        microInstructionToByteCode({
            RegASelect: 'pc',
            WriteSelect: 'REG_IMM',
            ExtraOp: 'IncrSP',
        }),
        addr,
    ];
}

function ret(addr) {
    return [
        microInstructionToByteCode({
            RegASelect: 'pc',
            WriteSelect: '',
            ExtraOp: 'IncrSP',
        }),
        addr,
    ];
}

const cpuState = {
    registers: new Uint16Array(8),
    memory: new Uint16Array(256),
};

function registerToIndex(reg) {
    switch (reg) {
        case 'x0': return 0;
        case 'x1': return 1;
        case 'x2': return 2;
        case 'x3': return 3;
        case 'x4': return 4;
        case 'x5': return 5;
        case 'x6': return 6;
        case 'sp': return 6;
        case 'x7': return 7;
        case 'pc': return 7;
        default:
            throw new Error('Invalid register');
    }
}

function runMicroInstruction(mi, imm16, imm32, cpuState) {
    const regAIndex = registerToIndex(mi.RegASelect);
    const regBIndex = registerToIndex(mi.RegBSelect);

    if (mi.ExtraOp === 'DecrSP') {
        cpuState.registers[6]--;
    }

    let ioAddr = mi.IOAddrSelect === 'IMM' ? imm32 : cpuState.registers[regBIndex];
    let ioIn = cpuState.memory[ioAddr];

    if (mi.WriteSelect != 'None') {
        switch (mi.WriteSelect) {
            case 'MEM_RegAOut':
                cpuState.memory[ioAddr] = cpuState.registers[regAIndex];
                break;
            case 'MEM_IMM':
                cpuState.memory[ioAddr] = imm16;
                break;
            case 'MEM_ALUOut':
                // @TODO use this??
                cpuState.memory[ioAddr] = alu(cpuState.registers[regAIndex], cpuState.registers[regBIndex], mi.ALUOp);
                break;
            case 'REG_IoBus':
                cpuState.registers[regAIndex] = ioIn;
                break;
            case 'REG_RegBOut':
                cpuState.registers[regAIndex] = cpuState.registers[regBIndex];
                break;
            case 'REG_IMM':
                cpuState.registers[regAIndex] = imm16;
                break;
            case 'REG_ALUOut':
                cpuState.registers[regAIndex] = alu(cpuState.registers[regAIndex], cpuState.registers[regBIndex], mi.ALUOp);
                break;
            case 'None':
                break;
            default:
                throw new Error('Invalid WriteSelect');
        }
    }

    if (mi.ExtraOp === 'IncrSP') {
        cpuState.registers[6]++;
    }
}

function wrap (val, bits = 16) {
    const values = 1 << bits;
    const max = values - 1;
    while (val < 0) {
        val += values;
    }
    if (val > max) {
        val %= values;
    }

    return val;
}

function alu (a, b, op, bits = 16) {
    const res = {
        data: 0,
        carry: false,
        overflow: false,
    };

    switch (op) {
        case 'add':
            res.data = a + b;
            if (res.data >= (1 << bits)) {
                res.data &= (1 << bits) - 1;
                res.carry = true;
                // @TODO overflow, signed
            }
            break;
        case 'sub':
            res.data = a - b;
            if (res.data < 0) {
                res.data += (1 << bits);
                res.carry = true;
                // @TODO overflow, signed
            }
            break;
        default:
            throw new Error('Invalid ALU operation ' + op);
    }
}