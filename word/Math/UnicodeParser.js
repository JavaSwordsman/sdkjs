/*
 * (c) Copyright Ascensio System SIA 2010-2019
 *
 * This program is a free software product. You can redistribute it and/or
 * modify it under the terms of the GNU Affero General Public License (AGPL)
 * version 3 as published by the Free Software Foundation. In accordance with
 * Section 7(a) of the GNU AGPL its Section 15 shall be amended to the effect
 * that Ascensio System SIA expressly excludes the warranty of non-infringement
 * of any third-party rights.
 *
 * This program is distributed WITHOUT ANY WARRANTY; without even the implied
 * warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR  PURPOSE. For
 * details, see the GNU AGPL at: http://www.gnu.org/licenses/agpl-3.0.html
 *
 * You can contact Ascensio System SIA at 20A-12 Ernesta Birznieka-Upisha
 * street, Riga, Latvia, EU, LV-1050.
 *
 * The  interactive user interfaces in modified source and object code versions
 * of the Program must display Appropriate Legal Notices, as required under
 * Section 5 of the GNU AGPL version 3.
 *
 * Pursuant to Section 7(b) of the License you must retain the original Product
 * logo when distributing the program. Pursuant to Section 7(e) we decline to
 * grant you any rights under trademark law for use of our trademarks.
 *
 * All the Product's GUI elements, including illustrations and icon sets, as
 * well as technical writing content are licensed under the terms of the
 * Creative Commons Attribution-ShareAlike 4.0 International. See the License
 * terms at http://creativecommons.org/licenses/by-sa/4.0/legalcode
 *
 */

"use strict";

(function (window)
{
    const Literals = AscMath.MathLiterals;
    const Struc = AscMath.MathStructures;

    const UnicodeSpecialScript = AscMath.UnicodeSpecialScript;
    const ConvertTokens = AscMath.ConvertTokens;
    const Tokenizer = AscMath.Tokenizer;
    const FunctionNames = AscMath.MathAutoCorrectionFuncNames;
    const LimitNames = AscMath.LimitFunctions;

    function CUnicodeParser()
    {
        this.oTokenizer = new Tokenizer(false);
        this.isTextLiteral = false;
        this.arrSavedTokens = [];
        this.isSaveTokens = false;
        this.SearchContext = [];

        //need for group like "|1+2|"
        this.strBreakSymbol = [];
    }

    CUnicodeParser.prototype.IsNotStopToken = function ()
    {
        if (this.SearchContext.length === 0)
            return true;

        let isFind,
            LastToken = this.SearchContext[this.SearchContext.length - 1];

        if (Array.isArray(LastToken))
            isFind = LastToken.includes(this.oLookahead.data);
        else
            isFind = this.oLookahead.data === LastToken;

        return !isFind;
    };
    CUnicodeParser.prototype.SetStopToken = function (str)
    {
        this.SearchContext.push(str);
    };
    CUnicodeParser.prototype.RemoveLastStopToken = function ()
    {
        let lastToken = this.SearchContext[this.SearchContext.length - 1];

        if (Array.isArray(lastToken))
        {
            for (let i = 0, len = lastToken.length; i < len; i++)
            {
                if (lastToken[i] === this.oLookahead.data)
                {
                    lastToken.splice(i, 1);
                    break;
                }
            }
        }
        else if (this.oLookahead.data === lastToken)
        {
            this.SearchContext.pop();
        }
    };
    CUnicodeParser.prototype.RemoveLastStopTokenForce = function ()
    {
        if (this.SearchContext.length > 0)
        {
            this.SearchContext.pop();
        }
    };
    CUnicodeParser.prototype.Parse = function (string)
    {
        this.oTokenizer.Init(string);

        // while (this.oTokenizer.IsHasMoreTokens())
        // {
        //     console.log( this.oTokenizer.GetNextToken())
        // }
        // return
        this.oLookahead = this.oTokenizer.GetNextToken();
        return this.Program();
    };
    CUnicodeParser.prototype.Program = function ()
    {
        const arrExp = [];
        while (this.oLookahead.data)
        {
            if (this.IsExpLiteral())
                arrExp.push(this.GetExpLiteral());
            else
                this.WriteDataAsCharLiteral(arrExp);
        }

        return {type: "UnicodeEquation", body: arrExp};
    };
    CUnicodeParser.prototype.WriteDataAsCharLiteral = function (arrExp)
    {
        if (arrExp.length === 1 && arrExp[arrExp.length - 1] !== undefined && arrExp[arrExp.length - 1].type === Literals.char.id)
        {
            arrExp[arrExp.length - 1].value += this.EatToken(this.oLookahead.class).data;
        }
        else
        {
            arrExp.push({type: Literals.char.id, value: this.EatToken(this.oLookahead.class).data});
        }
    };
    CUnicodeParser.prototype.GetSpaceLiteral = function ()
    {
        const oSpaceLiteral = this.EatToken(Literals.space.id);
        return {
            type: Struc.space,
            value: oSpaceLiteral.data,
        };
    };
    CUnicodeParser.prototype.IsSpaceLiteral = function ()
    {
        return this.oLookahead.class === Literals.space.id;
    };
    CUnicodeParser.prototype.GetOpCloseLiteral = function ()
    {
        let oCloseLiteral;

        if (this.oLookahead.data === "┤")
            return this.EatToken(this.oLookahead.class).data;

        if (this.oLookahead.class === Literals.lrBrackets.id)
        {
            oCloseLiteral = this.EatToken(Literals.lrBrackets.id);
            return oCloseLiteral.data;
        }

        oCloseLiteral = this.EatToken(Literals.rBrackets.id);
        return oCloseLiteral.data;
    };
    // CUnicodeParser.prototype.GetOpCloserLiteral = function () {
    // 	switch (this.oLookahead.class) {
    // 		case "┤":
    // 			return {
    // 				type: Struc.char,
    // 				value: this.EatToken("┤").data,
    // 			};
    // 		case Literals.rBrackets.id:
    // 		case Literals.lrBrackets.id:
    // 			return this.GetOpCloseLiteral();
    // 	}
    // };
    CUnicodeParser.prototype.IsOpNaryLiteral = function ()
    {
        return this.oLookahead.class === Literals.nary.id;
    };
    CUnicodeParser.prototype.GetOpNaryLiteral = function ()
    {
        let oContent;
        const oOpNaryLiteral = this.EatToken(Literals.nary.id);

        if (this.oLookahead.class === "▒")
        {
            this.EatToken("▒");
            oContent = this.GetElementLiteral()

            if (oContent.type === Literals.bracket.id && oContent.left === "(" && oContent.right === ")")
                oContent = oContent.value;
        }

        return {
            type: Struc.nary,
            value: oOpNaryLiteral.data,
            third: oContent,
        }

    };
    CUnicodeParser.prototype.GetOpOpenLiteral = function ()
    {
        let oOpLiteral;

        if (this.oLookahead.class === Literals.lrBrackets.id)
        {
            oOpLiteral = this.EatToken(Literals.lrBrackets.id);
            return oOpLiteral.data;
        }

        oOpLiteral = this.EatToken(Literals.lBrackets.id);

        return oOpLiteral.data;
    };
    CUnicodeParser.prototype.IsOpOpenLiteral = function ()
    {
        return this.oLookahead.class === Literals.lrBrackets.id ||
            this.oLookahead.class === Literals.lBrackets.id;
    };
    CUnicodeParser.prototype.IsOpOpenerLiteral = function ()
    {
        return this.oLookahead.class === Literals.lBrackets.id;
    };
    CUnicodeParser.prototype.GetDigitsLiteral = function ()
    {
        const arrNASCIIList = [this.GetASCIILiteral()];

        while (this.oLookahead.class === "nASCII")
            arrNASCIIList.push(this.GetASCIILiteral());

        return this.GetContentOfLiteral(arrNASCIIList);
    };
    CUnicodeParser.prototype.IsDigitsLiteral = function ()
    {
        return this.oLookahead.class === Literals.number.id;
    };
    CUnicodeParser.prototype.GetNumberLiteral = function ()
    {
        return this.GetDigitsLiteral();
    };
    CUnicodeParser.prototype.IsNumberLiteral = function ()
    {
        return this.IsDigitsLiteral();
    };
    CUnicodeParser.prototype.EatCloseOrOpenBracket = function ()
    {
        let strOpenLiteral, strCloseLiteral, oExp;

        if (this.oLookahead.data === "├")
        {
            this.EatToken(this.oLookahead.class);

            if (this.oLookahead.class === Literals.lrBrackets.id || this.oLookahead.class === Literals.lBrackets.id)
                strOpenLiteral = this.EatBracket().data;
            else
                strOpenLiteral = ".";

            let arrContent = this.GetContentOfBracket();
            oExp = arrContent[0];
            let counter = arrContent[1];

            if (this.oLookahead.data === "┤")
                this.EatToken(this.oLookahead.class);

            if (this.oLookahead.class === Literals.lrBrackets.id || this.oLookahead.class === Literals.rBrackets.id)
                strCloseLiteral = this.EatBracket().data;
            else
                strCloseLiteral = ".";

            return {
                type: Struc.bracket_block,
                left: strOpenLiteral,
                right: strCloseLiteral,
                value: oExp,
                counter: counter,
            };
        }
    };
    CUnicodeParser.prototype.EatBracket = function ()
    {
        let oBracket;
        switch (this.oLookahead.class)
        {
            case Literals.rBrackets.id:
                oBracket = this.GetOpCloseLiteral();
                break;
            case Literals.lBrackets.id:
                oBracket = this.GetOpOpenLiteral();
                break;
            case Literals.lrBrackets.id:
                oBracket = this.EatToken(this.oLookahead.class);
                break;
            case "Char":
                oBracket = this.GetCharLiteral();
                break;
            case "nASCII":
                oBracket = this.GetASCIILiteral();
                break;
            case Literals.space.id:
                oBracket = this.GetSpaceLiteral();
                break;
        }
        return oBracket;
    };
    CUnicodeParser.prototype.GetSoOperandLiteral = function (isSubSup)
    {
        if (this.IsOperandLiteral())
        {
            let one = this.GetOperandLiteral(isSubSup);
            this.EatOneSpace();
            return one;
        }

        switch (this.oLookahead.data)
        {
            case "-":
                let minus = this.EatToken(Literals.operator.id);

                if (this.IsOperandLiteral())
                {
                    const operand = this.GetOperandLiteral();
                    this.EatOneSpace();
                    return {
                        type: Struc.minus,
                        value: operand,
                    };
                }

                return {
                    type: Struc.char,
                    value: minus.data,
                }
            case "-∞":
                const token = this.EatToken(Literals.operator.id);
                return token.data;
            case "∞":
                const tokens = this.EatToken(Literals.operator.id);
                return tokens.data;
        }

        if (this.oLookahead.class === Literals.operator.id)
        {
            let one = this.GetOperandLiteral(isSubSup);
            this.EatOneSpace();
            return one;
        }

    };
    CUnicodeParser.prototype.IsSoOperandLiteral = function ()
    {
        return this.IsOperandLiteral() ||
            this.oLookahead.data === "-" ||
            this.oLookahead.data === "-∞" ||
            this.oLookahead.data === "∞"
    };
    CUnicodeParser.prototype.IsTextLiteral = function ()
    {
        return (this.oLookahead.data === "\"" || this.oLookahead.data === "\'") && !this.isTextLiteral
    };
    CUnicodeParser.prototype.GetTextLiteral = function ()
    {
        this.EatToken(this.oLookahead.class);
        let strExp = "";

        while (this.oLookahead.data !== "\"" && this.oLookahead.data !== "\'" && this.oLookahead.class !== undefined)
            strExp += this.EatToken(this.oLookahead.class).data;

        if (this.oLookahead.data === "\"" || this.oLookahead.data === "\'")
            this.EatToken(this.oLookahead.class);

        return {
            type: Struc.plain,
            value: strExp,
        }
    };
    CUnicodeParser.prototype.IsBoxLiteral = function ()
    {
        return this.oLookahead.data === "□";
    };
    CUnicodeParser.prototype.GetBoxLiteral = function ()
    {
        this.SaveTokensWhileReturn();

        if (this.oLookahead.data === "□")
        {
            this.EatToken(this.oLookahead.class);
            if (this.IsOperandLiteral())
            {
                const oToken = this.GetOperandLiteral();
                this.EatOneSpace();
                return {
                    type: Struc.box,
                    value: oToken,
                };
            }
        }

        return this.WriteSavedTokens();
    };
    CUnicodeParser.prototype.isRectLiteral = function ()
    {
        return this.oLookahead.data === "▭";
    };
    CUnicodeParser.prototype.GetRectLiteral = function ()
    {
        this.SaveTokensWhileReturn();

        if (this.oLookahead.data === "▭")
        {
            this.EatToken(this.oLookahead.class);
            this.EatOneSpace();
            if (this.IsOperandLiteral())
            {
                const oToken = this.GetOperandLiteral();
                this.EatOneSpace();
                return {
                    type: Struc.rect,
                    value: oToken,
                };
            }
        }

        return this.WriteSavedTokens();
    };
    CUnicodeParser.prototype.GetHBracketLiteral = function ()
    {
        this.SaveTokensWhileReturn();

        let strHBracket = this.EatToken(this.oLookahead.class).data;

        let oUp,
            oDown,
            oOperand;

        if (this.IsOperandLiteral())
        {
            this.EatOneSpace();
            oOperand = this.GetOperandLiteral("custom");
            this.EatOneSpace();

            if (this.IsScriptStandardContentLiteral() || this.IsScriptBelowOrAboveContent())
            {
                if (this.oLookahead.data === "_" || this.oLookahead.data === "┬")
                {
                    this.EatToken(this.oLookahead.class);
                    oDown = this.GetSoOperandLiteral();
                }
                else if (this.oLookahead.data === "^" || this.oLookahead.data === "┴")
                {
                    this.EatToken(this.oLookahead.class);
                    oUp = this.GetSoOperandLiteral();
                }
            }

            return {
                type: Struc.horizontal_bracket,
                hBrack: strHBracket,
                value: oOperand,
                up: oUp,
                down: oDown,
            };
        }

        return this.WriteSavedTokens();
    };
    CUnicodeParser.prototype.IsHBracketLiteral = function ()
    {
        return this.oLookahead.class === Literals.overbar.id
            || this.oLookahead.class === Literals.underbar.id;
    };
    CUnicodeParser.prototype.IsRootLiteral = function ()
    {
        return this.oLookahead.data === "⒭";
    };
    CUnicodeParser.prototype.GetRootLiteral = function ()
    {
        this.EatToken(this.oLookahead.class);
        this.EatOneSpace();

        let oIndex = this.GetExpLiteral();
        let oBase;

        if (this.oLookahead.data === "▒")
        {
            this.EatToken(this.oLookahead.class);
            this.EatOneSpace();
            oBase = this.GetExpLiteral();
        }

        return {
            type: Struc.radical,
            index: oIndex,
            value: oBase,
        }
    };
    CUnicodeParser.prototype.GetCubertLiteral = function ()
    {
        this.EatToken(this.oLookahead.class);

        return this.GetContentOfAnyTypeRadical({
            type: Struc.char,
            value: "3",
        });
    };
    CUnicodeParser.prototype.IsCubertLiteral = function ()
    {
        return this.oLookahead.data === "∛" && this.oLookahead.class !== Literals.operator.id;
    };
    CUnicodeParser.prototype.GetFourthrtLiteral = function ()
    {
        this.EatToken(Literals.radical.id);

        return this.GetContentOfAnyTypeRadical({
            type: Struc.char,
            value: "4",
        });
    };
    CUnicodeParser.prototype.IsFourthrtLiteral = function ()
    {
        return this.oLookahead.data === "∜" && this.oLookahead.class !== Literals.operator.id;
    };
    CUnicodeParser.prototype.GetNthrtLiteral = function ()
    {
        this.EatToken(this.oLookahead.class);
        return this.GetContentOfAnyTypeRadical();
    };
    CUnicodeParser.prototype.IsNthrtLiteral = function ()
    {
        return this.oLookahead.data === "√" && this.oLookahead.class !== Literals.operator.id || this.oLookahead.data === "√(";
    };
    CUnicodeParser.prototype.GetContentOfAnyTypeRadical = function (index)
    {
        let oIndex, oContent;

        if (this.IsOpOpenLiteral())
        {
            this.GetOpOpenLiteral();

            if (this.IsOperandLiteral())
            {
                this.SetStopToken("&");
                this.EatOneSpace();
                oIndex = this.GetExpLiteral();
                this.RemoveLastStopToken();
                this.EatOneSpace();

                if (this.oLookahead.data === "&")
                {
                    this.EatToken(this.oLookahead.class);

                    if (this.IsOperandLiteral())
                        oContent = this.GetExpLiteral();
                }
                else
                {
                    oContent = oIndex;
                    oIndex = undefined;
                }
            }

            if (this.oLookahead.class === Literals.rBrackets.id)
                this.EatToken(Literals.rBrackets.id);
        }
        else if (this.IsOperandLiteral())
        {
            this.EatOneSpace();
            oContent = this.GetOperandLiteral();
            this.EatOneSpace();
        }

        return {
            type: Struc.radical,
            index: index ? index : oIndex,
            value: oContent,
        };
    };
    CUnicodeParser.prototype.IsFunctionLiteral = function ()
    {
        return (
            this.IsRootLiteral() ||
            this.IsCubertLiteral() ||
            this.IsFourthrtLiteral() ||
            this.IsNthrtLiteral() ||
            this.IsBoxLiteral() ||
            this.isRectLiteral() ||
            this.IsHBracketLiteral() ||
            this.IsGetNameOfFunction() ||
            this.oLookahead.class === "▁" || this.oLookahead.class === "¯"
        );
    };
    CUnicodeParser.prototype.GetFunctionLiteral = function ()
    {
        let oFunctionContent;

        if (this.IsRootLiteral())
            oFunctionContent = this.GetRootLiteral();
        else if (this.IsCubertLiteral())
            oFunctionContent = this.GetCubertLiteral();
        else if (this.IsFourthrtLiteral())
            oFunctionContent = this.GetFourthrtLiteral();
        else if (this.IsNthrtLiteral())
            oFunctionContent = this.GetNthrtLiteral();
        else if (this.IsBoxLiteral())
            oFunctionContent = this.GetBoxLiteral();
        else if (this.isRectLiteral())
            oFunctionContent = this.GetRectLiteral();
        else if (this.oLookahead.data === "▁" || this.oLookahead.data === "¯")
        {
            if (this.IsOperandLiteral())
            {
                let strUnderOverLine = this.EatToken(this.oLookahead.class).data;
                this.EatOneSpace();
                let oOperand = this.GetOperandLiteral("custom");
                this.EatOneSpace();
                oFunctionContent = {
                    type: Struc.bar,
                    overUnder: strUnderOverLine,
                    value: oOperand,
                };
            }
        }
        else if (this.IsHBracketLiteral())
            oFunctionContent = this.GetHBracketLiteral();
        else if (this.IsGetNameOfFunction())
            oFunctionContent = this.GetNameOfFunction()
        return oFunctionContent;
    };
    CUnicodeParser.prototype.IsGetNameOfFunction = function ()
    {
        return this.oLookahead.class === Literals.func.id;
    };
    CUnicodeParser.prototype.GetNameOfFunction = function ()
    {
        let oName = this.EatToken(this.oLookahead.class).data,
            oThird;

        this.EatOneSpace();

        if (!this.IsExpSubSupLiteral())
        {
            oThird = this.GetOperandLiteral();
            this.EatOneSpace()
        }

        return {
            type: Struc.func,
            value: oName,
            third: oThird,
        }
    };
    CUnicodeParser.prototype.IsExpBracketLiteral = function ()
    {
        return (
            this.IsOpOpenerLiteral() ||
            this.oLookahead.class === Literals.lrBrackets.id ||
            this.oLookahead.data === "├"
        ) && !this.strBreakSymbol.includes(this.oLookahead.data) && this.strBreakSymbol[this.strBreakSymbol.length - 1] !== this.oLookahead.data;
    };
    CUnicodeParser.prototype.IsOpCloserLiteral = function ()
    {
        return this.oLookahead.class === Literals.rBrackets || this.oLookahead.class === Literals.lrBrackets || this.oLookahead.data === "┤"
    };
    CUnicodeParser.prototype.GetExpBracketLiteral = function ()
    {
        let strOpen,
            strClose,
            oExp;

        if (this.oLookahead.class === Literals.lBrackets.id || this.oLookahead.class === Literals.lrBrackets.id)
        {
            strOpen = this.GetOpOpenLiteral();

            if (strOpen === "|" || strOpen === "‖")
                this.strBreakSymbol.push(strOpen);

            if (this.IsPreScriptLiteral() && strOpen === "(")
                return this.GetPreScriptLiteral();

            let arrContent = this.GetContentOfBracket();
            oExp = arrContent[0];
            let counter = arrContent[1];

            if (oExp.length === 0 && !this.IsOpCloserLiteral())
            {
                return {
                    type: Struc.char,
                    value: strOpen,
                }
            }

            if (this.oLookahead.class === Literals.lrBrackets.id || this.oLookahead.class === Literals.rBrackets.id)
                strClose = this.GetOpCloseLiteral();
            else
                strClose = ".";

            if (strOpen === "〖" && strClose === "〗")
                return oExp;

            return {
                type: Struc.bracket_block,
                value: oExp,
                left: strOpen,
                right: strClose,
                counter: counter,
            };
        }
        else if (this.oLookahead.data === "├")
        {
            return this.EatCloseOrOpenBracket();
        }
    };
    CUnicodeParser.prototype.GetContentOfBracket = function ()
    {
        let arrContent = [];
        let intCountOfBracketBlock = 1;

        while (this.IsExpLiteral() || this.oLookahead.data === "∣" || this.oLookahead.data === "│" || this.oLookahead.data === "ⓜ" || this.oLookahead.data === "│")
        {
            if (this.IsExpLiteral())
            {
                let oToken = this.GetExpLiteral();

                if ((oToken && !Array.isArray(oToken)) || Array.isArray(oToken) && oToken.length > 0)
                    arrContent.push(oToken)
            }
            else
            {
                this.EatToken(this.oLookahead.class);
                intCountOfBracketBlock++;
            }
        }

        return [arrContent, intCountOfBracketBlock];
    }
    CUnicodeParser.prototype.GetPreScriptLiteral = function ()
    {
        let oFirstSoOperand,
            oSecondSoOperand,
            oBase;

        let strTypeOfPreScript = this.oLookahead.data;

        this.EatToken(this.oLookahead.class);

        if (strTypeOfPreScript === "_")
            oFirstSoOperand = this.GetSoOperandLiteral("preScript");
        else
            oSecondSoOperand = this.GetSoOperandLiteral("preScript");

        if (this.oLookahead.data !== strTypeOfPreScript && this.IsPreScriptLiteral())
        {
            this.EatToken(this.oLookahead.class);
            if (strTypeOfPreScript === "_")
                oSecondSoOperand = this.GetSoOperandLiteral("preScript");
            else
                oFirstSoOperand = this.GetSoOperandLiteral("preScript");
        }

        if (this.oLookahead.class === Literals.lrBrackets.id)
            this.EatToken(Literals.lrBrackets.id);
        else if (this.oLookahead.class === Literals.rBrackets.id)
            this.EatToken(Literals.rBrackets.id);

        this.EatOneSpace();
        oBase = this.GetElementLiteral();
        this.EatOneSpace();

        return {
            type: Struc.pre_script,
            value: oBase,
            down: oFirstSoOperand,
            up: oSecondSoOperand,
        }
    };
    CUnicodeParser.prototype.IsPreScriptLiteral = function ()
    {
        return (this.oLookahead.data === "_" || this.oLookahead.data === "^")
    };
    CUnicodeParser.prototype.GetScriptBaseLiteral = function ()
    {
        // if (this.oLookahead.class === oLiteralNames.anMathLiteral[0]) {
        // 	return this.GetAnMathLiteral();
        // }
        //else
        if (this.IsNumberLiteral())
        {
            return this.GetNumberLiteral();
        }
        else if (this.isOtherLiteral())
        {
            return this.GetOtherLiteral();
        }
        else if (this.IsExpBracketLiteral())
        {
            return this.GetExpBracketLiteral();
        }
            // else if (this.oLookahead.class === oLiteralNames.opBuildupLiteral[0]) {
            // 	return this.GetOpNaryLiteral();
        // }
        else if (this.IsAnOtherLiteral())
        {
            return this.GetAnOtherLiteral();
        }
        else if (this.oLookahead.class === Literals.char.id)
        {
            return this.GetCharLiteral();
        }
        else if (this.IsCubertLiteral())
        {
            return this.GetCubertLiteral();
        }
        else if (this.IsFourthrtLiteral())
        {
            return this.GetFourthrtLiteral();
        }
        else if (this.IsNthrtLiteral())
        {
            return this.GetNthrtLiteral();
        }
    };
    // CUnicodeParser.prototype.IsScriptBaseLiteral = function () {
    // 	return (
    // 		this.IsWordLiteral() ||
    // 		this.IsNumberLiteral() ||
    // 		this.isOtherLiteral() ||
    // 		this.IsExpBracketLiteral() ||
    // 		this.oLookahead.class === "anOther" ||
    // 		this.oLookahead.class === Literals.nary.id ||
    // 		this.oLookahead.class === "┬" ||
    // 		this.oLookahead.class === "┴" ||
    // 		this.oLookahead.class === oLiteralNames.charLiteral[0] ||
    // 		this.oLookahead.class === oLiteralNames.anMathLiteral[0]
    // 	);
    // };
    // CUnicodeParser.prototype.GetScriptSpecialContent = function (base) {
    // 	let oFirstSoOperand = [],
    // 		oSecondSoOperand = [];
    //
    // 	const ProceedScript = function (context) {
    // 		while (context.IsScriptSpecialContent()) {
    // 			if (context.oLookahead.class === oLiteralNames.specialScriptNumberLiteral[0]) {
    // 				let oSpecial = context.ReadTokensWhileEnd(oLiteralNames.specialScriptNumberLiteral, true);
    // 				oFirstSoOperand.push(oSpecial);
    // 			}
    // 			if (context.oLookahead.class === oLiteralNames.specialScriptCharLiteral[0]) {
    // 				let oSpecial = context.ReadTokensWhileEnd(oLiteralNames.specialScriptCharLiteral, true);
    // 				oFirstSoOperand.push(oSpecial);
    // 			}
    // 			if (context.oLookahead.class === oLiteralNames.specialScriptBracketLiteral[0]) {
    // 				let oSpecial = context.ReadTokensWhileEnd(oLiteralNames.specialScriptBracketLiteral, true)
    // 				oFirstSoOperand.push(oSpecial);
    // 			}
    // 			if (context.oLookahead.class === oLiteralNames.specialScriptOperatorLiteral[0]) {
    // 				let oSpecial = context.ReadTokensWhileEnd(oLiteralNames.specialScriptOperatorLiteral, true)
    // 				oFirstSoOperand.push(oSpecial);
    // 			}
    // 		}
    // 	};
    // 	const ProceedIndex = function (context) {
    // 		while (context.IsIndexSpecialContent()) {
    // 			if (context.oLookahead.class === oLiteralNames.specialIndexNumberLiteral[0]) {
    // 				let oSpecial = context.ReadTokensWhileEnd(oLiteralNames.specialIndexNumberLiteral, true);
    // 				oSecondSoOperand.push(oSpecial);
    // 			}
    // 			if (context.oLookahead.class === oLiteralNames.specialIndexCharLiteral[0]) {
    // 				let oSpecial = context.ReadTokensWhileEnd(oLiteralNames.specialIndexCharLiteral, true);
    // 				oSecondSoOperand.push(oSpecial);
    // 			}
    // 			if (context.oLookahead.class === oLiteralNames.specialIndexBracketLiteral[0]) {
    // 				let oSpecial = context.ReadTokensWhileEnd(oLiteralNames.specialIndexBracketLiteral, true)
    // 				oSecondSoOperand.push(oSpecial);
    // 			}
    // 			if (context.oLookahead.class === oLiteralNames.specialIndexOperatorLiteral[0]) {
    // 				let oSpecial = context.ReadTokensWhileEnd(oLiteralNames.specialIndexOperatorLiteral, true)
    // 				oSecondSoOperand.push(oSpecial);
    // 			}
    // 		}
    // 	};
    //
    // 	if (this.IsScriptSpecialContent()) {
    // 		ProceedScript(this);
    // 		if (this.IsIndexSpecialContent()) {
    // 			ProceedIndex(this);
    // 		}
    // 	} else if (this.IsIndexSpecialContent()) {
    // 		ProceedIndex(this);
    // 		if (this.IsScriptSpecialContent()) {
    // 			ProceedScript(this);
    // 		}
    // 	}
    //
    // 	return {
    // 		type: Struc.sub_sub,
    // 		value: base,
    // 		down: oSecondSoOperand,
    // 		up: oFirstSoOperand,
    // 	};
    // }
    // CUnicodeParser.prototype.IsSpecialContent = function () {
    // 	return false
    // 	// return (
    // 	// 	this.oLookahead.class === oLiteralNames.specialScriptNumberLiteral[0] ||
    // 	// 	this.oLookahead.class === oLiteralNames.specialScriptCharLiteral[0] ||
    // 	// 	this.oLookahead.class === oLiteralNames.specialScriptBracketLiteral[0] ||
    // 	// 	this.oLookahead.class === oLiteralNames.specialScriptOperatorLiteral[0] ||
    // 	//
    // 	// 	this.oLookahead.class === oLiteralNames.specialIndexNumberLiteral[0] ||
    // 	// 	this.oLookahead.class === oLiteralNames.specialIndexCharLiteral[0] ||
    // 	// 	this.oLookahead.class === oLiteralNames.specialIndexBracketLiteral[0] ||
    // 	// 	this.oLookahead.class === oLiteralNames.specialIndexOperatorLiteral[0]
    // 	//
    // 	// );
    // };
    // CUnicodeParser.prototype.IsScriptSpecialContent = function () {
    // 	return (
    // 		this.oLookahead.class === oLiteralNames.specialScriptNumberLiteral[0] ||
    // 		this.oLookahead.class === oLiteralNames.specialScriptCharLiteral[0] ||
    // 		this.oLookahead.class === oLiteralNames.specialScriptBracketLiteral[0] ||
    // 		this.oLookahead.class === oLiteralNames.specialScriptOperatorLiteral[0]
    // 	);
    // };
    // CUnicodeParser.prototype.IsIndexSpecialContent = function () {
    // 	return (
    // 		this.oLookahead.class === oLiteralNames.specialIndexNumberLiteral[0] ||
    // 		this.oLookahead.class === oLiteralNames.specialIndexCharLiteral[0] ||
    // 		this.oLookahead.class === oLiteralNames.specialIndexBracketLiteral[0] ||
    // 		this.oLookahead.class === oLiteralNames.specialIndexOperatorLiteral[0]
    // 	);
    // };
    CUnicodeParser.prototype.IsExpSubSupLiteral = function ()
    {
        return (
            this.IsScriptStandardContentLiteral() ||
            this.IsScriptBelowOrAboveContent()
            //this.IsSpecialContent()
        );
    };
    CUnicodeParser.prototype.GetExpSubSupLiteral = function (oBase)
    {
        let oThirdSoOperand,
            oContent;

        if (undefined === oBase)
        {
            oBase = this.GetScriptBaseLiteral();
        }
        else
        {
            if (FunctionNames.includes(oBase.value))
            {
                oBase.type = Struc.func;
            }
            else if (LimitNames.includes(oBase.value))
            {
                oBase.type = Struc.func_lim;
            }
        }

        // if (this.isPreScriptLiteral()) {
        // 	return this.preScriptLiteral();
        // }

        if (this.IsScriptStandardContentLiteral())
        {
            oContent = this.GetScriptStandardContentLiteral(oBase);
        }
        else if (this.IsScriptBelowOrAboveContent())
        {
            oContent = this.GetScriptBelowOrAboveContent(oBase);
        }
        // else if (this.IsSpecialContent())
        // {
        //     oContent = this.GetScriptSpecialContent(oBase);
        // }

        this.EatOneSpace();

        if (this.oLookahead.class === "▒")
        {
            if (oBase.type === Struc.radical ||
                oBase.type === Struc.nary ||
                oBase.type === Struc.func ||
                oBase.type === Struc.func_lim
            )
            {
                this.EatToken("▒");
                oThirdSoOperand = this.GetElementLiteral();
                return {
                    type: Struc.sub_sub,
                    value: oBase,
                    down: oContent.down,
                    up: oContent.up,
                    third: oThirdSoOperand,
                };
            }
            else
            {
                this.EatToken(this.oLookahead.class);
                return oContent;
            }
        }
        else if (
            oBase.type === Struc.func ||
            oBase.type === Struc.func_lim ||
            oBase.type === Struc.nary
        )
        {
            if (this.oLookahead.class === Literals.space.id)
            {
                this.EatToken(this.oLookahead.class);
            }

            if (this.oLookahead.class)
            {
                oThirdSoOperand = this.GetOperandLiteral();
                this.EatOneSpace();

                return {
                    type: Struc.sub_sub,
                    value: oBase,
                    down: oContent.down,
                    up: oContent.up,
                    third: oThirdSoOperand,
                };
            }
        }

        this.EatOneSpace();

        return oContent;
    };
    CUnicodeParser.prototype.EatOneSpace = function ()
    {
        if (this.oLookahead.class === Literals.space.id)
        {
            this.EatToken(this.oLookahead.class);
        }

    }
    CUnicodeParser.prototype.GetScriptStandardContentLiteral = function (oBase)
    {
        let oFirstElement;
        let oSecondElement;

        if (this.oLookahead.data === "_")
        {
            this.EatToken(this.oLookahead.class);
            this.EatOneSpace();

            if (this.IsSoOperandLiteral())
            {
                oFirstElement = (oBase && oBase.type === Struc.nary)
                    ? this.GetSoOperandLiteral("custom")
                    : this.GetSoOperandLiteral("_");
            }
            else if (this.IsExpLiteral())
            {
                oFirstElement = this.GetExpLiteral();
            }

            // Get second element
            if (this.oLookahead.data === "^")
            {
                this.EatToken(this.oLookahead.class);
                this.EatOneSpace();

                if (this.IsSoOperandLiteral())
                {
                    oSecondElement = this.GetSoOperandLiteral("^");
                }
                else if (this.IsExpLiteral())
                {
                    oSecondElement = this.GetExpLiteral();
                }

                return {
                    type: Struc.sub_sub,
                    value: oBase,
                    down: oFirstElement,
                    up: oSecondElement,
                };
            }
            return {
                type: Struc.sub_sub,
                value: oBase,
                down: oFirstElement,
            };
        }
        else if (this.oLookahead.data === "^")
        {
            this.EatToken(this.oLookahead.class);
            this.EatOneSpace();

            if (this.IsSoOperandLiteral())
            {
                oSecondElement = (oBase && oBase.type === Struc.nary)
                    ? this.GetSoOperandLiteral("custom")
                    : this.GetSoOperandLiteral("^");
            }
            else if (this.IsExpLiteral())
            {
                oSecondElement = this.GetExpLiteral();
            }

            if (oSecondElement && (oSecondElement.value === "′" || oSecondElement.value === "′′" || oSecondElement === "‵"))
            {
                oSecondElement = oSecondElement.value;
            }

            if (this.oLookahead.data === "_")
            {
                this.EatToken(this.oLookahead.class);

                if (this.IsSoOperandLiteral())
                {
                    oFirstElement = this.GetSoOperandLiteral("_");
                }
                else if (this.IsExpLiteral())
                {
                    oFirstElement = this.GetExpLiteral();
                }

                return {
                    type: Struc.sub_sub,
                    value: oBase,
                    down: oFirstElement,
                    up: oSecondElement,
                };
            }

            return {
                type: Struc.sub_sub,
                value: oBase,
                up: oSecondElement,
            };
        }
    };
    CUnicodeParser.prototype.IsScriptStandardContentLiteral = function ()
    {
        return this.oLookahead.data === "_" || this.oLookahead.data === "^";
    };
    CUnicodeParser.prototype.GetScriptBelowOrAboveContent = function (base)
    {
        let oBelowAbove,
            strType,
            isBelow = true;

        strType = this.EatToken(this.oLookahead.class).data;

        if (strType === "┴")
            isBelow = false;

        oBelowAbove = this.GetElementLiteral();

        if (base.type === Struc.func)
        {
            this.EatOneSpace();
            let third = this.GetOperandLiteral();
            this.EatOneSpace();
            return {
                type: Struc.func_lim,
                value: base.value,
                up: strType === "┴" ? oBelowAbove : undefined,
                down: strType !== "┴" ? oBelowAbove : undefined,
                third: third,
            }
        }

        return {
            type: Struc.below_above,
            base: base,
            value: oBelowAbove,
            isBelow: isBelow,
        };
    };
    CUnicodeParser.prototype.IsScriptBelowOrAboveContent = function ()
    {
        return this.oLookahead.class === "┬" || this.oLookahead.class === "┴";
    };
    CUnicodeParser.prototype.GetFractionLiteral = function (oNumerator)
    {
        let oOperand,
            strOpOver;

        if (undefined === oNumerator)
        {
            oNumerator = this.GetOperandLiteral();
            this.EatOneSpace();
        }

        if (this.oLookahead.class === Literals.divide.id)
        {
            strOpOver = this.EatToken(this.oLookahead.class).data;


            if (this.IsOperandLiteral())
                oOperand = this.GetFractionLiteral();

            this.EatOneSpace();

            if (strOpOver === "⊘")
            {
                return {
                    type: Struc.box,
                    argSize: -1,
                    value: {
                        type: Struc.frac,
                        up: oNumerator || {},
                        down: oOperand || {},
                        fracType: this.GetFractionType("/"),
                    },
                };
            }

            return {
                type: Struc.frac,
                up: oNumerator || {},
                down: oOperand || {},
                fracType: this.GetFractionType(strOpOver),
            };
        }
        else
        {
            return oNumerator;
        }
    };
    CUnicodeParser.prototype.GetFractionType = function (str)
    {
        switch (str)
        {
            case "/" :
                return BAR_FRACTION;
            case "⁄" :
                return SKEWED_FRACTION;
            case "∕" :
                return LINEAR_FRACTION;
            case "¦" :
                return NO_BAR_FRACTION;
        }
    }
    CUnicodeParser.prototype.IsFractionLiteral = function ()
    {
        return this.IsOperandLiteral();
    };
    CUnicodeParser.prototype.GetOtherLiteral = function ()
    {
        return this.GetCharLiteral();
    };
    CUnicodeParser.prototype.isOtherLiteral = function ()
    {
        return this.oLookahead.class === Literals.char.id;
    };
    CUnicodeParser.prototype.GetOperatorLiteral = function ()
    {
    	const oOperator = this.EatToken(Literals.operator.id);
    	this.EatOneSpace();
    	return {
    		type: Literals.operator.id,
    		value: oOperator.data,
    	};
    };
    CUnicodeParser.prototype.GetASCIILiteral = function ()
    {
        return this.ReadTokensWhileEnd(Literals.number, Struc.number)
    };
    CUnicodeParser.prototype.GetCharLiteral = function ()
    {
        return this.ReadTokensWhileEnd(Literals.char, Struc.char)
    };
    // CUnicodeParser.prototype.GetAnMathLiteral = function ()
    // {
    //     const oAnMathLiteral = this.EatToken(anMathLiteral);
    //     return {
    //         type: anMathLiteral,
    //         value: oAnMathLiteral.data,
    //     };
    // };
    // CUnicodeParser.prototype.IsAnMathLiteral = function ()
    // {
    //     return this.oLookahead.class === oLiteralNames.anMathLiteral[0];
    // };
    CUnicodeParser.prototype.GetAnOtherLiteral = function ()
    {
        if (this.oLookahead.class === Literals.other.id)
        {
            return this.ReadTokensWhileEnd(Literals.other, Struc.other)
        }
        else if (this.oLookahead.class === Literals.char.id)
        {
            return this.GetCharLiteral();
        }
        else if (this.oLookahead.class === Literals.number.id)
        {
            return this.GetNumberLiteral();
        }
        else if (this.oLookahead.data === "." || this.oLookahead.data === ",")
        {
            return {
                type: Literals.char.id,
                value: this.EatToken(this.oLookahead.class).data,
            }
        }
    };
    CUnicodeParser.prototype.IsAnOtherLiteral = function ()
    {
        return (
            this.oLookahead.class === Literals.other.id ||
            this.oLookahead.class === Literals.char.id ||
            this.oLookahead.class === Literals.number.id ||
            this.oLookahead.data === "." || this.oLookahead.data === ","
        );
    };
    CUnicodeParser.prototype.GetAnLiteral = function ()
    {
        if (this.IsAnOtherLiteral())
        {
            return this.GetAnOtherLiteral();
        }
        //return this.GetAnMathLiteral();
    };
    CUnicodeParser.prototype.IsAnLiteral = function ()
    {
        return this.IsAnOtherLiteral() //|| this.IsAnMathLiteral();
    };
    CUnicodeParser.prototype.GetDiacriticBaseLiteral = function ()
    {
        let oDiacriticBase;

        if (this.IsAnLiteral())
        {
            oDiacriticBase = this.GetAnLiteral();
            return {
                type: Struc.diacritic_base,
                value: oDiacriticBase,
                isAn: true,
            };
        }
        else if (this.oLookahead.class === "nASCII")
        {
            oDiacriticBase = this.GetASCIILiteral();
            return {
                type: Struc.diacritic_base,
                value: oDiacriticBase,
            };
        }
        else if (this.oLookahead.class === "(")
        {
            this.EatToken("(");
            oDiacriticBase = this.GetExpLiteral();
            this.EatToken(")");
            return {
                type: Struc.diacritic_base,
                value: oDiacriticBase,
            };
        }
    };
    CUnicodeParser.prototype.IsDiacriticBaseLiteral = function ()
    {
        return (
            this.IsAnLiteral() ||
            this.oLookahead.class === Literals.number.id ||
            this.oLookahead.class === "("
        );
    };
    CUnicodeParser.prototype.GetDiacriticsLiteral = function ()
    {
        const arrDiacriticList = [];

        while (this.IsDiacriticsLiteral())
        {
            arrDiacriticList.push(this.EatToken(Literals.accent.id).data);
        }

        return this.GetContentOfLiteral(arrDiacriticList);
    };
    CUnicodeParser.prototype.IsDiacriticsLiteral = function ()
    {
        return this.oLookahead.class === Literals.accent.id;
    };
    CUnicodeParser.prototype.GetAtomLiteral = function ()
    {
        const oAtom = this.GetDiacriticBaseLiteral();
        if (oAtom.isAn)
        {
            return oAtom.value
        }
        return oAtom;
    };
    CUnicodeParser.prototype.IsAtomLiteral = function ()
    {
        return (this.IsAnLiteral() || this.IsDiacriticBaseLiteral()) && this.IsNotStopToken(this.oLookahead.data);
    };
    CUnicodeParser.prototype.GetAtomsLiteral = function ()
    {
        const arrAtomsList = [];
        while (this.IsAtomLiteral())
        {
            let atom = this.GetAtomLiteral();

            if (this.IsPrimeLiteral())
                arrAtomsList.push(this.GetPrimeLiteral(atom))
            else
                arrAtomsList.push(atom);

        }
        return this.GetContentOfLiteral(arrAtomsList)
    };
    CUnicodeParser.prototype.IsAtomsLiteral = function ()
    {
        return this.IsAtomLiteral();
    };
    CUnicodeParser.prototype.GetTextOperandLiteral = function()
    {
        return this.ReadTokensWhileEnd(Literals.operand, Struc.char, false)
    };
    CUnicodeParser.prototype.GetEntityLiteral = function ()
    {
        if (this.IsTextLiteral())
        {
            return this.GetTextLiteral()
        }
        else if (this.IsAtomsLiteral())
        {
            return this.GetAtomsLiteral();
        }
        else if (this.IsExpBracketLiteral())
        {
            return this.GetExpBracketLiteral();
        }
        else if (this.IsNumberLiteral())
        {
            return this.GetNumberLiteral();
        }
        else if (this.IsOpNaryLiteral())
        {
            return this.GetOpNaryLiteral();
        }
        else if (this.oLookahead.class === Literals.operand.id)
        {
            return this.GetTextOperandLiteral()
        }
    };
    CUnicodeParser.prototype.IsEntityLiteral = function ()
    {
        return this.IsAtomsLiteral()
                || this.IsExpBracketLiteral()
                || this.IsNumberLiteral()
                || this.IsOpNaryLiteral()
                || this.IsTextLiteral()
                || this.oLookahead.class === Literals.operand.id;
    };
    CUnicodeParser.prototype.IsEqArrayLiteral = function ()
    {
        return this.oLookahead.class === "█"
    };
    CUnicodeParser.prototype.GetEqArrayLiteral = function ()
    {
        this.SaveTokensWhileReturn();
        this.EatToken(this.oLookahead.class);

        if (this.oLookahead.data === "(")
        {
            this.EatToken(this.oLookahead.class);
            let oContent = [];

            while (this.IsRowLiteral() && this.IsNotStopToken())
            {
                if (this.oLookahead.class === "@")
                {
                    this.EatToken("@");

                    if (this.oLookahead.class === "&")
                        this.EatToken("&");
                }
                else
                {
                    this.SetStopToken(["&", "@"])
                    oContent.push(this.GetRowLiteral());
                }

                if (this.oLookahead.data === ")")
                {
                    this.EatToken(this.oLookahead.class);

                    return {
                        type: Struc.matrix,
                        value: oContent,
                    }
                }
            }
        }
        else
        {
            return {
                type: Struc.char,
                value: "█"
            }
        }

        return this.WriteSavedTokens();
    };
    CUnicodeParser.prototype.IsPrimeLiteral = function ()
    {
        return this.oLookahead.data === "⁗" ||
            this.oLookahead.data === "‴" ||
            this.oLookahead.data === "″" ||
            this.oLookahead.data === "′";
    };
    CUnicodeParser.prototype.GetPrimeLiteral = function (oBase)
    {
        let strPrime = this.EatToken(this.oLookahead.class).data;

        return {
            type: Struc.sub_sub,
            up: {
                type: Struc.char,
                value: strPrime,
            },
            value: oBase,
        }
    };
    CUnicodeParser.prototype.GetFactorLiteral = function ()
    {
        if (this.IsDiacriticsLiteral())
        {
            const oDiacritic = this.GetDiacriticsLiteral();
            return {
                type: Struc.accent,
                value: oDiacritic,
            };
        }
        else if (this.IsEntityLiteral() && !this.IsFunctionLiteral())
        {
            let oEntity = this.GetEntityLiteral();

            if (this.IsPrimeLiteral())
                return this.GetPrimeLiteral(oEntity);

            if (this.IsDiacriticsLiteral())
            {
                const oDiacritic = this.GetDiacriticsLiteral();
                return {
                    type: Struc.accent,
                    base: oEntity,
                    value: oDiacritic,
                };
            }
            return oEntity;
        }
        else if (this.IsFunctionLiteral())
        {
            return this.GetFunctionLiteral();
        }
        else if (this.IsExpSubSupLiteral())
        {
            return this.GetExpSubSupLiteral();
        }
        if (this.IsArrayLiteral())
        {
            return this.GetArrayLiteral();
        }
        else if (this.IsEqArrayLiteral())
        {
            return this.GetEqArrayLiteral();
        }
    };
    CUnicodeParser.prototype.IsFactorLiteral = function ()
    {
        return (this.IsEntityLiteral() || this.IsFunctionLiteral() || this.IsDiacriticsLiteral() || this.IsArrayLiteral() || this.IsEqArrayLiteral()) && this.IsNotStopToken()
    };
    CUnicodeParser.prototype.IsSpecial = function (isNoSubSup)
    {
        return this.oLookahead.data === isNoSubSup || (
            !isNoSubSup && this.IsScriptStandardContentLiteral() ||
            !isNoSubSup && this.IsScriptBelowOrAboveContent()// ||
            //!isNoSubSup && this.IsSpecialContent()
        )
    }
    CUnicodeParser.prototype.GetOperandLiteral = function (isNoSubSup)
    {
        const arrFactorList = [];

        if (undefined === isNoSubSup)
            isNoSubSup = false;

        let isBreak = false;

        while (this.IsFactorLiteral() && !this.IsExpSubSupLiteral() && !isBreak)
        {
            if (this.IsFactorLiteral() && !this.IsExpSubSupLiteral())
            {
                arrFactorList.push(this.GetFactorLiteral());

                if (arrFactorList[arrFactorList.length - 1])
                    isBreak = arrFactorList[arrFactorList.length - 1].type === 'BracketBlock';
            }

            if (this.IsSpecial(isNoSubSup) && arrFactorList[arrFactorList.length - 1])
            {
                let oContent = arrFactorList[arrFactorList.length - 1];

                while (this.IsSpecial(isNoSubSup))
                {
                    //if next token "_" or "^" proceed as index/degree
                    if (this.oLookahead.data === isNoSubSup || !isNoSubSup && this.IsScriptStandardContentLiteral())
                    {
                        oContent = this.GetExpSubSupLiteral(oContent);
                    }
                    //if next token "┬" or "┴" proceed as below/above
                    else if (this.oLookahead.data === isNoSubSup || !isNoSubSup && this.IsScriptBelowOrAboveContent())
                    {
                        oContent = this.GetScriptBelowOrAboveContent(oContent);
                    }
                    //if next token like ⁶⁷⁸⁹ or ₂₃₄ proceed as special degree/index
                    // else if (this.oLookahead.data === isNoSubSup || !isNoSubSup) //  && this.IsSpecialContent()
                    // {
                    //     oContent = this.GetScriptSpecialContent(oContent);
                    // }
                }
                arrFactorList[arrFactorList.length - 1] = oContent;
            }

            if (this.IsApplicationFunction() && arrFactorList[arrFactorList.length - 1])
            {
                let oContent = this.GetFunctionApplication(arrFactorList[arrFactorList.length - 1]);
                arrFactorList[arrFactorList.length - 1] = oContent;
            }
        }

        return this.GetContentOfLiteral(arrFactorList);
    };
    CUnicodeParser.prototype.IsApplicationFunction = function()
    {
        return this.oLookahead.class === Literals.invisible.id;
    }
    CUnicodeParser.prototype.GetFunctionApplication = function(oBase)
    {
        // if (undefined === oBase)
        // {
        //     oBase = this.GetScriptBaseLiteral();
        // }

        this.EatToken(this.oLookahead.class);
        let oValue = this.GetOperandLiteral();

        return {
            type: Struc.func,
            value: oBase,
            third: oValue,
        }

    }
    CUnicodeParser.prototype.IsOperandLiteral = function ()
    {
        return this.IsFactorLiteral() && this.IsNotStopToken(this.oLookahead.data);
    };
    CUnicodeParser.prototype.IsRowLiteral = function ()
    {
        return this.IsExpLiteral() || this.oLookahead.data === "&";
    };
    CUnicodeParser.prototype.GetRowLiteral = function ()
    {
        let arrRow = [];
        let intLength = 0;
        let intCount = 0;
        let isAlredyGetContent = false;

        while (this.IsExpLiteral() || this.oLookahead.data === "&")
        {
            let intCopyOfLength = intLength;

            if (this.oLookahead.data !== "&" && this.IsNotStopToken())
            {
                this.RemoveLastStopTokenForce();
                this.SetStopToken(["&", "@"])
                arrRow.push(this.GetExpLiteral());
                intLength++;
                isAlredyGetContent = true;
            }
            else
            {
                this.RemoveLastStopToken();
                this.EatToken("&");

                if (isAlredyGetContent === false)
                {
                    arrRow.push({});
                    intCount++;
                    intLength++;
                }
                else if (intCopyOfLength === intLength)
                {
                    intCount++;
                }
            }
        }

        if (intLength !== intCount + 1)
        {

            for (let j = intLength; j <= intCount; j++)
            {
                arrRow.push({});
            }
        }

        return arrRow;
    };
    CUnicodeParser.prototype.GetRowsLiteral = function ()
    {
        let arrRows = [];

        while (this.IsRowLiteral() || this.oLookahead.data === "@")
        {
            if (this.oLookahead.data === "@")
            {
                this.EatToken("@");
            }
            else
            {
                this.RemoveLastStopTokenForce();
                this.SetStopToken(["&", "@"])
                arrRows.push(this.GetRowLiteral());
            }
        }
        return arrRows
    };
    CUnicodeParser.prototype.GetArrayLiteral = function ()
    {
        let type = this.EatToken(this.oLookahead.class).data;

        if (this.oLookahead.data !== "(")
        {
            return {
                type: Literals.char.id,
                value: type
            }
        }
        else
        {
            this.EatToken(this.oLookahead.class);
        }

        const arrMatrixContent = this.GetRowsLiteral();

        let intMaxLengthOfMatrixRow = -Infinity;
        let intIndexOfMaxMatrixRow = -1;

        for (let i = 0; i < arrMatrixContent.length; i++)
        {
            let arrContent = arrMatrixContent[i];
            intMaxLengthOfMatrixRow = arrContent.length;
            intIndexOfMaxMatrixRow = i;
        }

        for (let i = 0; i < arrMatrixContent.length; i++)
        {

            if (i !== intIndexOfMaxMatrixRow)
            {

                let oRow = arrMatrixContent[i];

                for (let j = oRow.length; j < intMaxLengthOfMatrixRow; j++)
                {
                    oRow.push({});
                }
            }
        }

        if (this.oLookahead.data === ")")
        {
            this.EatToken(Literals.rBrackets.id);
            return {
                type: Struc.matrix,
                value: arrMatrixContent,
            };
        }
    };
    CUnicodeParser.prototype.IsArrayLiteral = function ()
    {
        return this.oLookahead.class === Literals.matrix.id;
    };
    CUnicodeParser.prototype.IsElementLiteral = function ()
    {
        return (
            this.IsFractionLiteral() ||
            this.IsOperandLiteral()
            && this.IsNotStopToken(this.oLookahead.data)
        );
    };
    CUnicodeParser.prototype.GetElementLiteral = function ()
    {
        let oOperandLiteral = this.GetOperandLiteral();

        if (this.oLookahead.class === Literals.divide.id)
            oOperandLiteral = this.GetFractionLiteral(oOperandLiteral);

        return oOperandLiteral;
    };
    CUnicodeParser.prototype.IsExpLiteral = function ()
    {
        return this.IsElementLiteral()
            || this.IsFractionWithoutNumeratorLiteral()
            || this.IsSpaceLiteral()
            || this.oLookahead.class === Literals.operator.id
    };
    CUnicodeParser.prototype.GetFractionWithoutNumeratorLiteral = function()
    {
        let strDivideSymbol = this.EatToken(this.oLookahead.class);
        let oDenominator = {};
        if (this.IsOperandLiteral())
            oDenominator = this.GetOperandLiteral();

        return {
            type: Struc.frac,
            up: {},
            down: oDenominator,
            fracType: this.GetFractionType(strDivideSymbol),
        };
    };
    CUnicodeParser.prototype.IsFractionWithoutNumeratorLiteral = function()
    {
        return this.oLookahead.class === Literals.divide.id;
    }
    CUnicodeParser.prototype.GetExpLiteral = function ()
    {
        const oExpLiteral = [];

        while (this.IsExpLiteral())
        {
            if (this.IsFractionWithoutNumeratorLiteral())
            {
                oExpLiteral.push(this.GetFractionWithoutNumeratorLiteral());
            }
            else if (this.IsSpaceLiteral())
                oExpLiteral.push(this.GetSpaceLiteral());
            else if (this.IsElementLiteral())
            {
                oExpLiteral.push(this.GetElementLiteral());

                if (this.isOtherLiteral())
                    oExpLiteral.push(this.GetOtherLiteral());
            }
            else if (this.oLookahead.class === Literals.operator.id) {
                oExpLiteral.push(this.GetOperatorLiteral())
            }
        }

        return this.GetContentOfLiteral(oExpLiteral)
    };
    /**
     * Метод позволяет обрабатывать токены одного типа, пока они не прервутся другим типом токенов
     */
    CUnicodeParser.prototype.ReadTokensWhileEnd = function (arrTypeOfLiteral, type, isSpecial)
    {
        let arrLiterals = [];
        let strLiteral = "";
        let style;
        while (this.oLookahead.class === arrTypeOfLiteral.id && this.IsNotStopToken(this.oLookahead.data))
        {
            style = this.oLookahead.style;
            if (isSpecial)
                strLiteral += UnicodeSpecialScript[this.EatToken(arrTypeOfLiteral.id).data];
            else
                strLiteral += this.EatToken(arrTypeOfLiteral.id).data;
        }

        //console.log(style, this.oLookahead)

        arrLiterals.push({type: type, value: strLiteral, style: style});

        if (arrLiterals.length === 1)
            return arrLiterals[0];

        return arrLiterals
    };
    CUnicodeParser.prototype.EatToken = function (tokenType)
    {
        const token = this.oLookahead;

        if (token === null)
        {
            console.log('Unexpected end of input, expected: "' + tokenType + '"');
        }

        if (token.class !== tokenType)
        {
            console.log('Unexpected token: "' + token.class + '", expected: "' + tokenType + '"');
        }

        if (this.isSaveTokens)
            this.arrSavedTokens.push(this.oLookahead);

        this.oLookahead = this.oTokenizer.GetNextToken();
        return token;
    };
    CUnicodeParser.prototype.GetContentOfLiteral = function (oContent)
    {
        if (Array.isArray(oContent))
        {
            if (oContent.length === 1)
                return oContent[0];

            return oContent;
        }
        return oContent;
    };
    CUnicodeParser.prototype.SkipSpace = function ()
    {
        while (this.oLookahead.class === Literals.space.id)
        {
            this.EatToken(Literals.space.id);
        }
    };
    CUnicodeParser.prototype.SaveTokensWhileReturn = function ()
    {
        this.isSaveTokens = true;
        this.arrSavedTokens = [];
    };
    CUnicodeParser.prototype.WriteSavedTokens = function ()
    {
        let intSavedTokensLength = this.arrSavedTokens.length;
        let strOutput = "";
        for (let i = 0; i < intSavedTokensLength; i++)
        {
            let str = this.oTokenizer.GetTextOfToken(this.arrSavedTokens[i].index, false);

            if (str)
                strOutput += str;
            else
                strOutput += this.arrSavedTokens[i].data;
        }

        this.isSaveTokens = false;

        return {
            type: Literals.char.id,
            value: strOutput,
        };
    };

    function CUnicodeConverter(str, oContext, isGetOnlyTokens)
    {
        if (undefined === str || null === str)
            return;

        const oParser = new CUnicodeParser();
        const oTokens = oParser.Parse(str);

        if (!isGetOnlyTokens)
            ConvertTokens(oTokens, oContext);
        else
            return oTokens;
    }

    //--------------------------------------------------------export----------------------------------------------------
    window["AscMath"] = window["AscMath"] || {};
    window["AscMath"].CUnicodeConverter = CUnicodeConverter;

})(window);
