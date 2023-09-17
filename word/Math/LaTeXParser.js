/*
 * (c) Copyright Ascensio System SIA 2010-2023
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
 * You can contact Ascensio System SIA at 20A-6 Ernesta Birznieka-Upish
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
(function (window) {
	const Literals = AscMath.MathLiterals;
	const Struc = AscMath.MathStructures;

	const ConvertTokens = window.AscMath.ConvertTokens;
	const Tokenizer = window.AscMath.Tokenizer;
	const LimitFunctions = window.AscMath.LimitFunctions;
	const FunctionNames = window.AscMath.MathAutoCorrectionFuncNames;
	const GetTypeFont = window.AscMath.GetTypeFont;
	const GetMathFontChar = window.AscMath.GetMathFontChar;

	function CLaTeXParser() {
		this.oTokenizer = new Tokenizer(true);
		this.intMathFontType = -1;
		this.isReceiveOneTokenAtTime = false;
		this.isNowMatrix = false;
		this.EscapeSymbol = "";
	}
	CLaTeXParser.prototype.IsNotEscapeSymbol = function ()
	{
		return this.oLookahead.data !== this.EscapeSymbol;
	};
	CLaTeXParser.prototype.ReadTokensWhileEnd = function (arrTypeOfLiteral, type)
	{
		let arrLiterals = [];
		let strLiteral = "";
		let styles = [];

		let isOne = this.isReceiveOneTokenAtTime;

		if (isOne)
		{
			let strValue = this.EatToken(arrTypeOfLiteral).data;
			let oLiteral = {
				type: type,
				value: this.intMathFontType === -1
					? strValue
					: GetMathFontChar[strValue][this.intMathFontType],
			};
		}
		else
		{
			while (this.oLookahead.class === arrTypeOfLiteral.id && this.EscapeSymbol !== this.oLookahead.data)
			{
				styles.push(this.oLookahead.style);
				strLiteral += this.EatToken(this.oLookahead.class).data;
			}
		}

		arrLiterals.push({type: type, value: strLiteral, style: styles});

		if (arrLiterals.length === 1)
			return arrLiterals[0];

		return arrLiterals
	};
	CLaTeXParser.prototype.SaveState = function (oLookahead)
	{
		this.oTokenizer.SaveState(oLookahead);
	};
	CLaTeXParser.prototype.RestoreState = function ()
	{
		this.oLookahead = this.oTokenizer.RestoreState();
	};
	CLaTeXParser.prototype.Parse = function (string)
	{
		this.oTokenizer.Init(string);
		this.oLookahead = this.oTokenizer.GetNextToken();
		return this.GetASTTree();
	};
	CLaTeXParser.prototype.GetASTTree = function ()
	{
		let arrExp = [];
		while (this.oLookahead.data)
		{
			if (this.IsElementLiteral())
			{
				arrExp.push(this.GetExpressionLiteral())
			}
			else
			{
				let strValue = this.oTokenizer.GetTextOfToken(this.oLookahead.class, true);
				if (undefined === strValue)
				{
					strValue = this.EatToken(this.oLookahead.class).data
				}
				else
				{
					this.EatToken(this.oLookahead.class);
				}

				if ("\\bmod" === strValue) // todo в новой версии конвертора добавить отдельный модуль для такого типа токенов
				{
					strValue = " mod "; // в обратную сторону (линейную) такие токены вряд ли получится конвертнуть,
										// а ворде такого токена просто нет
										// todo продумать как будет происходить преобразование в линейную форму
				}

				arrExp.push({
					type: Struc.char,
					value: strValue
				})
			}
		}
		return {
			type: "LaTeXEquation",
			body: arrExp,
		};
	};
	CLaTeXParser.prototype.GetCharLiteral = function ()
	{
		return this.ReadTokensWhileEnd(Literals.char, Struc.char);
	};
	CLaTeXParser.prototype.GetOtherLiteral = function ()
	{
		return this.ReadTokensWhileEnd(Literals.other, Struc.other);
	};
	CLaTeXParser.prototype.GetSpaceLiteral = function ()
	{
		//todo LaTex skip all normal spaces
		this.ReadTokensWhileEnd(Literals.space, Struc.space);
	};
	CLaTeXParser.prototype.GetNumberLiteral = function ()
	{
		return this.ReadTokensWhileEnd(Literals.number, Struc.number);
	};
	CLaTeXParser.prototype.GetOperatorLiteral = function ()
	{
		const strToken = this.EatToken(Literals.operator.id);
		return {
			type: Struc.char,
			value: strToken.data,
		};
	};
	CLaTeXParser.prototype.IsAccentLiteral = function ()
	{
		return this.oLookahead.class === Literals.accent.id;
	};
	CLaTeXParser.prototype.GetAccentLiteral = function (oBase)
	{
		let strAccent,
			oResultAccent,
			oPr;

		//this.oLookahead.data = MathLiterals.accent.toSymbols[this.oLookahead.data];

		if (this.oLookahead.data === "'" || this.oLookahead.data === "''")
		{
			return this.GetSubSupLiteral(oBase);
			// strAccent = this.EatToken(this.oLookahead.class).data;
			// oResultAccent = {
			// 	type: oLiteralNames.subSupLiteral[num],
			// 	value: oBase,
			// 	up: {
			// 		type: oLiteralNames.charLiteral[num],
			// 		value: strAccent,
			// 	}
			// };
		}
		else
		{
			oPr = this.oLookahead.style;
			strAccent = this.oLookahead;
			this.EatToken(this.oLookahead.class);

			strAccent.data = AscMath.MathLiterals.accent.LaTeX[strAccent.data];

			// if (Literals.accent.toSymbols[strAccent])
			// 	strAccent = Literals.accent.toSymbols[strAccent];

			oBase = this.GetArguments(1);
			oBase = this.GetContentOfLiteral(oBase);

			oResultAccent = {
				type: Struc.accent,
				base: oBase,
				value: strAccent,
				style: oPr,
			};
		}

		return oResultAccent;
	};
	CLaTeXParser.prototype.IsFractionLiteral = function ()
	{
		return this.oLookahead.data === "\\frac"
			|| this.oLookahead.data === "\\binom"
			|| this.oLookahead.data === "\\cfrac"
			|| this.oLookahead.data === "\\sfrac";
	};
	CLaTeXParser.prototype.GetFractionType = function (str)
	{
		switch (str)
		{
			case "\\frac"	:	return BAR_FRACTION;    break;
			case "\\binom"	:	return NO_BAR_FRACTION; break;
			default         :   return SKEWED_FRACTION; break;
		}
	}
	CLaTeXParser.prototype.GetFractionLiteral = function ()
	{
		let oFracStyle = this.oLookahead.style;
		let type = this.GetFractionType(this.oLookahead.data);
		this.EatToken(this.oLookahead.class);
		const oResult = this.GetArguments(2);

		return {
			type: Struc.frac,
			up: oResult[0] || {},
			down: oResult[1] || {},
			fracType: type,
			style: oFracStyle,
		};

	};
	CLaTeXParser.prototype.IsExpBracket = function ()
	{
		return this.oLookahead.class === Literals.lrBrackets.id
			|| this.oLookahead.class === Literals.lBrackets.id
			|| this.oLookahead.data === "├"
			|| this.oLookahead.data === "\\left";
	};
	CLaTeXParser.prototype.GetBracketLiteral = function ()
	{
		let arrBracketContent,
			strLeftSymbol,
			strRightSymbol,
			startStyle,
			middle_styles = [],
			endStyle;

		if (this.oLookahead.data === "├" || this.oLookahead.data === "\\left")
		{
			this.EatToken(this.oLookahead.class);

			if (this.oLookahead.class === Literals.lBrackets.id || this.oLookahead.data === "." || this.oLookahead.class === Literals.lrBrackets.id)
			{
				startStyle = this.oLookahead.style;
				strLeftSymbol = this.EatToken(this.oLookahead.class).data;
			}

			arrBracketContent = this.GetContentOfBracket("\\right", middle_styles);

			if (this.oLookahead.data === "┤" || this.oLookahead.data === "\\right")
			{
				this.EatToken(this.oLookahead.class);
				if (this.oLookahead.class === Literals.rBrackets.id || this.oLookahead.data === "." || this.oLookahead.class === Literals.lrBrackets.id)
				{
					endStyle = this.oLookahead.style;
					strRightSymbol = this.EatToken(this.oLookahead.class).data;
				}
			}
		}
		else if (this.oLookahead.class === Literals.lBrackets.id || this.oLookahead.class === Literals.lrBrackets.id)
		{
			startStyle = this.oLookahead.style;
			strLeftSymbol = this.EatToken(this.oLookahead.class).data;
			
			if (this.oLookahead.data === "_" || this.oLookahead.data === "^")
				return this.GetPreScriptLiteral();

			if (strLeftSymbol === "|" || strLeftSymbol === "‖")
			{
				this.SaveState(this.oLookahead);
				arrBracketContent = this.GetContentOfBracket(strLeftSymbol, middle_styles);
			}
			else
			{
				arrBracketContent = this.GetContentOfBracket(undefined, middle_styles);
			}

			// if (this.oLookahead.class === undefined) {
			// 	this.RestoreState();
			// 	return {
			// 		type: oLiteralNames.charLiteral[num],
			// 		value: strLeftSymbol,
			// 	}
			// }

			if (this.oLookahead.class === Literals.rBrackets.id || this.oLookahead.class === Literals.lrBrackets.id)
			{
				endStyle = this.oLookahead.style;
				strRightSymbol = this.EatToken(this.oLookahead.class).data;
			}
		}

		return {
			type: Struc.bracket_block,
			left: strLeftSymbol,
			right: strRightSymbol,
			value: arrBracketContent,
			style: {
				startStyle : startStyle,
				endStyle : endStyle,
				middle: middle_styles,
			},
		};
	};
	CLaTeXParser.prototype.GetContentOfBracket = function (strLeftSymbol, arrMiddleStyles)
	{
		let arrContent = [];
		let intCountOfBracketBlock = 1;

		while (this.IsElementLiteral() || this.oLookahead.data === "∣" || this.oLookahead.data === "\\mid"|| this.oLookahead.data === "ⓜ")
		{
			if (this.oLookahead.data === "\\right")
			{
				break;
			}

			if (this.IsElementLiteral())
			{
				if (arrContent.length === 0)
				{
					this.SkipFreeSpace();
				}

				let oToken = [this.GetExpressionLiteral(strLeftSymbol)];
				if ((oToken && !Array.isArray(oToken)) || Array.isArray(oToken) && oToken.length > 0)
				{
					arrContent.push(oToken)
				}
			}
			else
			{
				arrMiddleStyles.push(this.oLookahead.style)
				this.EatToken(this.oLookahead.class);
				intCountOfBracketBlock++;
			}
		}

		while (arrContent.length < intCountOfBracketBlock)
		{
			arrContent.push([]);
		}

		return arrContent;
	};
	CLaTeXParser.prototype.IsElementLiteral = function ()
	{
		return this.oLookahead.class !== null && this.IsNotEscapeSymbol() && (
			this.IsFractionLiteral() ||
			this.oLookahead.class === Literals.number.id ||
			this.oLookahead.class === Literals.char.id ||
			this.oLookahead.class === Literals.space.id ||
			this.IsSqrtLiteral() ||
			this.IsExpBracket() ||
			this.IsFuncLiteral() ||
			this.oLookahead.class === "\\middle" ||
			this.IsAccentLiteral() ||
			this.IsPreScript() ||
			this.IsChangeMathFont() ||
			this.oLookahead.class === "{" ||
			this.oLookahead.class === Literals.operator.id ||
			this.IsReactLiteral() ||
			this.IsBoxLiteral() ||
		//	this.oLookahead.class === oLiteralNames.opDecimal[0] ||
			this.IsMatrixLiteral() ||
			this.IsHBracket() ||
			this.oLookahead.data === "\\below" ||
			this.oLookahead.data === "\\above" ||
			this.IsOverUnderBarLiteral() ||
			this.IsTextLiteral() ||
			this.IsSpecialSymbol() ||
			this.oLookahead.class === Literals.other.id
		);
	};
	CLaTeXParser.prototype.IsSpecialSymbol = function ()
	{
		return this.oLookahead.data === "/" ||
			this.oLookahead.data === "&" ||
			this.oLookahead.data === "@" ||
			this.oLookahead.data === "." ||
			this.oLookahead.data === ","
	}
	CLaTeXParser.prototype.GetSpecialSymbol = function ()
	{
		return {
			type: Struc.char,
			value: this.EatToken(this.oLookahead.class).data
		}
	}
	CLaTeXParser.prototype.GetElementLiteral = function ()
	{
		if  (this.IsSpecialSymbol())
		{
			return this.GetSpecialSymbol()
		}
		else if (this.IsFractionLiteral())
		{
			return this.GetFractionLiteral();
		}
		else if (this.oLookahead.class === Literals.number.id)
		{
			return this.GetNumberLiteral();
		}
		else if (this.oLookahead.class === Literals.char.id)
		{
			return this.GetCharLiteral();
		}
		else if (this.oLookahead.class === Literals.char.id)
		{
			return this.GetOtherLiteral();
		}
		// else if (this.oLookahead.class === oLiteralNames.opDecimal[0])
		// {
		// 	let strDecimalLiteral = this.EatToken(this.oLookahead.class).data;
		// 	return {
		// 		type: oLiteralNames.opDecimal[num],
		// 		value: strDecimalLiteral
		// 	}
		// }
		else if (this.oLookahead.class === Literals.space.id)
		{
			return this.GetSpaceLiteral();
		}
		else if (this.IsSqrtLiteral())
		{
			return this.GetSqrtLiteral();
		}
		else if (this.IsExpBracket())
		{
			return this.GetBracketLiteral();
		}
		else if (this.IsFuncLiteral())
		{
			return this.GetFuncLiteral();
		}
		else if (this.oLookahead.class === "\\middle")
		{
			this.EatToken("\\middle");
			return {
				type: "MiddleLiteral",
				value: this.EatToken(this.oLookahead.class).data,
			};
		}
		else if (this.IsAccentLiteral())
		{
			return this.GetAccentLiteral();
		}
		else if (this.IsPreScript())
		{
			return this.GetPreScriptLiteral();
		}
		else if (this.IsChangeMathFont())
		{
			return this.GetMathFontLiteral();
		}
		// else if (this.IsSymbolLiteral()) {
		// 	return this.GetSymbolLiteral()
		// }
		else if (this.oLookahead.data === "{")
		{
			return this.GetArguments(1)[0];
		}
		else if (this.oLookahead.class ===Literals.operator.id)
		{
			return this.GetOperatorLiteral()
		}
		else if (this.IsReactLiteral())
		{
			return this.GetRectLiteral()
		}
		else if (this.IsBoxLiteral())
		{
			return this.GetBoxLiteral()
		}
		else if (this.IsMatrixLiteral())
		{
			return this.GetMatrixLiteral();
		}
		else if (this.IsOverUnderBarLiteral())
		{
			return this.GetUnderOverBarLiteral();
		}
		else if (this.IsHBracket())
		{
			return this.GetHBracketLiteral()
		}
		else if (this.IsTextLiteral())
		{
			return this.GetTextLiteral();
		}
		else if (this.oLookahead.data === "/")
		{
			this.EatToken(this.oLookahead.class);
			return {
				type: Struc.char,
				value: "/",
			}
		}
	};
	CLaTeXParser.prototype.IsGetBelowAboveLiteral = function()
	{
		return this.oLookahead.data === "\\below" || this.oLookahead.data === "\\above";
	}
	CLaTeXParser.prototype.GetBelowAboveLiteral = function(base)
	{
		let isBelow = true;
		if (this.oLookahead.data === "\\above")
			isBelow = false;

		this.EatToken(this.oLookahead.class);
		let oContent = this.GetArguments(1);

		if(base && base.type === Struc.func)
		{
			this.SkipFreeSpace();
			let third = this.GetArguments(1);
			return {
				type: Struc.func_lim,
				value: base.value,
				up: !isBelow ? oContent : undefined,
				down: isBelow ? oContent : undefined,
				third: third,
			}
		}

		return {
			type: Struc.limit,
			base: base,
			value: oContent,
			isBelow: isBelow,
		};
	}
	CLaTeXParser.prototype.IsTextLiteral = function ()
	{
		return this.oLookahead.data === "\\text"
	}
	CLaTeXParser.prototype.GetTextLiteral = function ()
	{
		this.EatToken(this.oLookahead.class);
		let oContent = this.GetTextArgument();

		return {
			type: Struc.char,
			value: oContent,
		}
	}
	CLaTeXParser.prototype.GetTextArgument = function ()
	{
		let strText = "";

		this.EatToken(this.oLookahead.class); // {

		while (this.oLookahead.data !== "}" && this.oLookahead.data !== undefined)
		{
			strText += this.EatToken(this.oLookahead.class).data;
		}

		this.EatToken(this.oLookahead.class); // }

		return strText;
	}
	CLaTeXParser.prototype.IsFuncLiteral = function ()
	{
		return this.oLookahead.class === Literals.func.id || this.oLookahead.class === Literals.nary.id
	};
	CLaTeXParser.prototype.GetFuncLiteral = function ()
	{
		let oFuncContent = this.EatToken(this.oLookahead.class);
		let oPr = oFuncContent.style;

		if (this.oLookahead.class === "\\limits")
			this.EatToken("\\limits");

		if (this.oLookahead.data === " ")
			this.EatToken(this.oLookahead.class);

		let oThirdContent = !this.IsSubSup() && !this.IsGetBelowAboveLiteral()
			? this.GetArguments(1)
			: undefined;

		let name = oFuncContent.data.slice(1)

		if (oFuncContent.class === Literals.nary.id)
		{
			return {
				type: Struc.nary,
				value: Literals.nary.LaTeX[oFuncContent.data],
				style: oPr,
				third: oThirdContent,
			}
		}
		else if (LimitFunctions.includes(name))
		{
			return {
				type: Struc.func_lim,
				value: {
					type: Struc.char,
					value: name,
					style: oPr,
				},
				style: oPr,
				third: oThirdContent,
			}
		}
		else if (FunctionNames.includes(name))
		{
			return {
				type: Struc.func,
				value: name,
				style: oPr,
				third: oThirdContent,
			}
		}
	};
	CLaTeXParser.prototype.IsReactLiteral = function ()
	{
		return this.oLookahead.class === Literals.rect.id;
	};
	CLaTeXParser.prototype.GetRectLiteral = function ()
	{
		this.EatToken(this.oLookahead.class);
		let oContent = this.GetArguments(1);
		return {
			type: Struc.rect,
			value: oContent,
		}
	};
	CLaTeXParser.prototype.IsOverUnderBarLiteral = function ()
	{
		return this.oLookahead.data === "▁" || this.oLookahead.data === "¯"
	};
	CLaTeXParser.prototype.GetUnderOverBarLiteral = function ()
	{
		let strUnderOverLine = this.EatToken(this.oLookahead.class).data;
		let oOperand = this.GetArguments(1);
		return {
			type: Struc.group_character,
			overUnder: strUnderOverLine,
			value: oOperand,
		};
	};
	CLaTeXParser.prototype.IsBoxLiteral = function ()
	{
		return this.oLookahead.class === Literals.box.id;
	}
	CLaTeXParser.prototype.GetBoxLiteral = function ()
	{
		this.EatToken(this.oLookahead.class);
		let oContent = this.GetArguments(1);
		return {
			type: Struc.box,
			value: oContent,
		}
	};
	CLaTeXParser.prototype.GetBorderBoxLiteral = function ()
	{
		return this.oLookahead.class === Literals.rect.id;
	}
	CLaTeXParser.prototype.IsGetBorderBoxLiteral = function ()
	{
		this.EatToken(this.oLookahead.class);
		let oContent = this.GetArguments(1);
		return {
			type: Struc.rect,
			value: oContent,
		}
	}
	CLaTeXParser.prototype.IsHBracket = function ()
	{
		return this.oLookahead.class === Literals.hbrack.id;
	};
	CLaTeXParser.prototype.GetHBracketLiteral = function ()
	{
		let oDown, oUp;
		let hBrack = this.EatToken(this.oLookahead.class).data;
		let oContent = this.GetArguments(1);
		this.SkipFreeSpace();
		if (this.oLookahead.data === "_" || this.oLookahead.data === "^") {
			if (this.oLookahead.class === "_") {
				this.EatToken(this.oLookahead.class);
				oDown = this.GetArguments(1);
			}
			else {
				this.EatToken(this.oLookahead.class);
				oUp = this.GetArguments(1);
			}
		}
		return {
			type: Struc.horizontal,
			value: oContent,
			hBrack: hBrack,
			down: oDown,
			up: oUp,
		}
	};
	CLaTeXParser.prototype.GetWrapperElementLiteral = function ()
	{
		if (!this.IsSubSup() && this.oLookahead.class !== "\\over")
		{
			let oWrapperContent = this.GetElementLiteral();

			if (this.IsSubSup() || this.oLookahead.class === "\\limits")
			{
				return this.GetSubSupLiteral(oWrapperContent);
			}
			else if (this.oLookahead.class === Literals.accent.id)
			{
				return this.GetAccentLiteral(oWrapperContent);
			}
			else if (this.IsGetBelowAboveLiteral())
			{
				return this.GetBelowAboveLiteral(oWrapperContent)
			}

			// else if (this.oLookahead.class === "\\over") {
			// 	//TODO
			// }

			return oWrapperContent;
		}
	};
	CLaTeXParser.prototype.GetWrapperElement2 = function ()
	{
		let oWrapperContent = this.GetElementLiteral();

		if (this.oLookahead.class === Literals.accent.id)
		{
			return this.GetAccentLiteral(oWrapperContent);
		}
		else if (this.IsGetBelowAboveLiteral())
		{
			return this.GetBelowAboveLiteral(oWrapperContent)
		}

		return oWrapperContent;
	};
	CLaTeXParser.prototype.IsSubSup = function ()
	{
		return this.oLookahead.data === "^" || this.oLookahead.data === "_";
	};
	CLaTeXParser.prototype.GetSubSupLiteral = function (oBaseContent, isSingle)
	{
		let isLimits,
			oDownContent,
			oUpContent,
			oThirdContent,
			oSubStyle,
			oSupStyle;

		if (undefined === oBaseContent)
		{
			oBaseContent = this.GetElementLiteral();
		}
		if (this.oLookahead.class === "\\limits")
		{
			this.EatToken("\\limits");
			isLimits = true;
		}

		if (oBaseContent.type === Struc.bracket_block && oBaseContent.left === "{" && oBaseContent.right === "}")
		{
			oBaseContent = oBaseContent.value;
		}

		if (this.oLookahead.data === "'" || this.oLookahead.data === "''")
		{
			oUpContent = {
				type: Struc.char,
				value: this.EatToken(this.oLookahead.class).data
			}
		}

		if (this.oLookahead.data === "_")
		{
			oSubStyle = this.oLookahead.style;
			oDownContent = this.GetPartOfSupSup();
			if (this.oLookahead.data === "^" && isSingle !== true)
			{
				oSupStyle = this.oLookahead.style;
				oUpContent = this.GetPartOfSupSup();
			}
			else if (oDownContent && oDownContent.down === undefined && oDownContent.base)
			{
				oDownContent = oDownContent.base;
			}
		}
		else if (this.oLookahead.data === "^")
		{
			oSupStyle = this.oLookahead.style;
			oUpContent = this.GetPartOfSupSup();
			if (this.oLookahead.data === "_" && isSingle !== true)
			{
				oSubStyle = this.oLookahead.style;
				oDownContent = this.GetPartOfSupSup();
			}
			else if (oUpContent && oUpContent.up === undefined && oUpContent.base && oUpContent.type !== "BelowAboveLiteral")
			{
				oUpContent = oUpContent.base;
			}
		}

		if (oBaseContent && (oBaseContent.type === Struc.func || oBaseContent.type == Struc.func_lim || oBaseContent.type ===  Struc.nary))
		{
			oThirdContent = this.GetArguments(1);
		}

		return {
			type: Struc.sub_sub,
			value: oBaseContent,
			up: oUpContent,
			down: oDownContent,
			third: oThirdContent,
			isLimits: isLimits,
			style: {supStyle: oSupStyle, subStyle: oSubStyle},
		};
	};
	CLaTeXParser.prototype.GetPartOfSupSup = function ()
	{
		let oElement;
		let strSymbol = this.oLookahead.class;
		this.EatToken(strSymbol);

		if (this.oLookahead.data === "'" || this.oLookahead.data === "''")
		{
			oElement = {
				type: Struc.char,
				value: this.EatToken(this.oLookahead.class).data
			}
		}
		else
		{
			if (this.oLookahead.data === "{")
			{
				oElement = this.GetArguments(1);

			}
			else
			{
				oElement = this.GetWrapperElement2();
			}
		}

		if (this.oLookahead.data === strSymbol) {
			oElement = this.GetSubSupLiteral(oElement, true);
		}
		return oElement;
	};
	CLaTeXParser.prototype.IsPreScript = function ()
	{
		return (this.oLookahead.class === "^" || this.oLookahead.class === "_");
	};
	CLaTeXParser.prototype.GetPreScriptLiteral = function ()
	{
		let oUpContent;
		let oDownContent;
		let oBaseContent;
		let oOutput;

		if (this.oLookahead.class === "_") {
			oDownContent = this.GetPartOfSupSup();
			if (this.oLookahead.class === "^") {
				oUpContent = this.GetPartOfSupSup();
			}
		}
		else if (this.oLookahead.class === "^") {
			oUpContent = this.GetPartOfSupSup();
			if (this.oLookahead.class === "_") {
				oDownContent = this.GetPartOfSupSup();
			}
		}

		if (this.oLookahead.data === "}") {
			this.EatToken(this.oLookahead.class)
		}

		this.SkipFreeSpace();
		oBaseContent = this.GetElementLiteral();

		oOutput = { //precstript!
			type: Struc.sub_sub,
		};
		if (oUpContent) {
			oOutput.up = oUpContent;
		}
		if (oDownContent) {
			oOutput.down = oDownContent;
		}
		if (oBaseContent) {
			oOutput.value = oBaseContent;
		}
		return oOutput;
	};
	CLaTeXParser.prototype.IsSqrtLiteral = function ()
	{
		return this.oLookahead.class === Literals.radical.id;
	};
	CLaTeXParser.prototype.GetSqrtLiteral = function ()
	{
		let oBaseContent,
			oIndexContent,
			oOutput,
			oStyle = this.oLookahead.style;

		this.EatToken(Literals.radical.id);
		if (this.oLookahead.data === "[")
		{
			this.EatToken(this.oLookahead.class);
			oIndexContent = this.GetExpressionLiteral("]");
			if (this.oLookahead.data === "]")
			{
				this.EatToken(this.oLookahead.class);
			}
		}
		oBaseContent = this.GetArguments(1);
		oOutput = {
			type: Struc.radical,
			value: oBaseContent,
			style: oStyle,
		};

		if (oIndexContent)
			oOutput.index = oIndexContent;
		return oOutput;
	};
	CLaTeXParser.prototype.IsChangeMathFont = function ()
	{
		return false //this.oLookahead.class === oLiteralNames.mathFontLiteral[0]
	};
	CLaTeXParser.prototype.GetMathFontLiteral = function ()
	{
		// let intPrevType = this.intMathFontType;
		// this.intMathFontType = GetTypeFont[this.oLookahead.data];
		//
		// if (this.oLookahead.data !== "{") {
		// 	this.isReceiveOneTokenAtTime = true;
		// }
		//
		// this.EatToken(this.oLookahead.class)
		// let oOutput = {
		// 	type: oLiteralNames.mathFontLiteral[num],
		// 	value: this.GetArguments(1)
		// };
		// this.isReceiveOneTokenAtTime = false;
		// this.intMathFontType = intPrevType;
		// return oOutput;
	};
	CLaTeXParser.prototype.IsMatrixLiteral = function ()
	{
		return (
			this.oLookahead.class === Literals.matrix.id ||
			this.oLookahead.data === "█" ||
			this.oLookahead.data === "■" ||
			this.oLookahead.data === "\\substack"
		)
	};
	CLaTeXParser.prototype.IsAlignBlockForArray = function ()
	{
		if (this.oLookahead.data !== "{")
			return false;

		this.SaveState(this.oLookahead);

		let oAlignBlock = this.GetArguments(1);

		const IsAlignContent = function (str)
		{
			let arr = [];
			for (let i = 0; i < str.length; i++)
			{
				if (str[i] === "l" || str[i] === "c" || str[i] === "r")
					arr.push(true);
			}

			if (arr.length === str.length)
				return true;

			return false;
		}

		if (oAlignBlock.type === Struc.char)
		{
			let strAlignBlock = oAlignBlock.value.trim();

			if (IsAlignContent(strAlignBlock))
				return strAlignBlock;
		}
		else
		{
			this.RestoreState();
		}
	}
	CLaTeXParser.prototype.GetMatrixLiteral = function ()
	{
		let strMatrixType;

		switch (this.oLookahead.data) {
			case "\\begin{cases}":
				strMatrixType = "{";
				break
			case "\\begin{pmatrix}":
			case "\\pmatrix":
			case "⒨":
				strMatrixType = "()";
				break;
			case "\\begin{bmatrix}":
			case "\\bmatrix":
				strMatrixType = "[]";
				break;
			case "\\begin{Bmatrix}":
			case "\\Bmatrix":
				strMatrixType = "{}";
				break;
			case "\\begin{vmatrix}":
			case "\\vmatrix":
				strMatrixType = "|";
				break;
			case "\\begin{Vmatrix}":
			case "⒩":
			case "\\Vmatrix":
				strMatrixType = "‖";
				break;
			case "\\begin{array}":
			case "\\begin{equation}":
			case "\\substack":
			case "■":
			//case "█":
			default:
				strMatrixType = "";
		}

		this.isNowMatrix = true;

		let name = this.EatToken(this.oLookahead.class).data;

		if (name === "\\substack")
		{
			this.EatToken(this.oLookahead.class);
		}

		while (this.oLookahead.data === "[")
		{
			this.GetArguments(1);
		}

		//TODO align
		let align = this.IsAlignBlockForArray();

		this.SkipFreeSpace();

		while (this.oLookahead.data === "[")
		{
			this.GetArguments(1);
		}

		let arrMatrixContent = [];

		while (this.oLookahead.data !== "}" && this.oLookahead.class !== "endOfMatrix")
		{
			arrMatrixContent.push(this.GetRayOfMatrixLiteral());
		}

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

			if (i !== intIndexOfMaxMatrixRow) {

				let arrMatrix = arrMatrixContent[i];

				for (let j = arrMatrix.length; j < intMaxLengthOfMatrixRow; j++)
				{
					arrMatrix.push({});
				}
			}
		}

		if (this.oLookahead.data === "}" || this.oLookahead.class === "endOfMatrix")
		{
			this.EatToken(this.oLookahead.class)
		}

		this.isNowMatrix = false;

		return {
			type: Struc.matrix,
			value: arrMatrixContent
		}
	};
	CLaTeXParser.prototype.GetRayOfMatrixLiteral = function ()
	{
		let arrRayContent;

		while (this.oLookahead.data !== "\\\\" && this.oLookahead.data !== "}" && this.oLookahead.class !== "endOfMatrix") {
			arrRayContent = this.GetElementOfMatrix();
		}

		if (this.oLookahead.data === "\\\\") {
			this.EatToken(this.oLookahead.class)
		}

		this.SkipFreeSpace();

		return arrRayContent
	};
	CLaTeXParser.prototype.GetElementOfMatrix = function ()
	{
		let arrRow = [];
		let intLength = 0;
		let intCount = 0;
		let isAlredyGetContent = false;

		while (this.IsElementLiteral() || this.oLookahead.data === "&") {
			let intCopyOfLength = intLength;

			if (this.oLookahead.data !== "&") {
				arrRow.push(this.GetExpressionLiteral("&"));
				intLength++;
				isAlredyGetContent = true;
				this.SkipFreeSpace();
			}
			else {
				this.EatToken(this.oLookahead.class);

				if (isAlredyGetContent === false) {
					arrRow.push({});
					intCount++;
					intLength++;
				} else if (intCopyOfLength === intLength) {
					intCount++;
				}

				this.SkipFreeSpace();
			}

		}

		if (intLength !== intCount + 1) {
			for (let j = intLength; j <= intCount; j++) {
				arrRow.push({});
			}
		}

		return arrRow;
	};
	CLaTeXParser.prototype.IsExpressionLiteral = function(strBreak)
	{
		const arrEndOfExpression = ["}", "\\endgroup", "\\end", "┤"];

		//todo refactor
		return 	this.IsElementLiteral() &&
				this.oLookahead.data !== strBreak &&
				this.oLookahead.data !== this.EscapeSymbol &&
				!arrEndOfExpression.includes(this.oLookahead.data)
	};
	CLaTeXParser.prototype.GetExpressionLiteral = function (strBreakSymbol)
	{
		this.EscapeSymbol = strBreakSymbol;
		const arrExpList = [];

		while (this.IsExpressionLiteral(strBreakSymbol))
		{
			if (this.IsPreScript())
				arrExpList.push(this.GetPreScriptLiteral());
			else
				arrExpList.push(this.GetWrapperElementLiteral());
		}

		this.EscapeSymbol = undefined;
		return this.GetContentOfLiteral(arrExpList)
	};
	CLaTeXParser.prototype.EatToken = function (tokenType)
	{
		if (tokenType !== undefined && this.oLookahead.class === tokenType) {
			const oToken = this.oLookahead;
			if (oToken === null) {
				console.log('Unexpected end of input, expected: ' + tokenType);
			}
			if (oToken.class !== tokenType) {
				console.log('Unexpected token: ' + oToken.class + ', expected: ' + tokenType);
			}
			this.oLookahead = this.oTokenizer.GetNextToken();
			return oToken;
		}
	};
	CLaTeXParser.prototype.SkipFreeSpace = function ()
	{
		while (this.oLookahead.class === Literals.space.id) {
			this.oLookahead = this.oTokenizer.GetNextToken();
		}
	};
	CLaTeXParser.prototype.GetArguments = function (intCountOfArguments)
	{
		let oArgument = [];
		while (intCountOfArguments > 0) {
			this.SkipFreeSpace();
			if (this.oLookahead.data === "{") {
				this.SkipFreeSpace();
				this.EatToken(this.oLookahead.class);
				oArgument.push(this.GetExpressionLiteral());
				this.EatToken(this.oLookahead.class);
			}
			else {
				this.SkipFreeSpace();
				oArgument.push(this.GetWrapperElementLiteral());
			}
			intCountOfArguments--;
		}
		if (oArgument.length === 1 && Array.isArray(oArgument)) {
			return oArgument[0];
		}
		return oArgument;
	};
	CLaTeXParser.prototype.GetContentOfLiteral = function (oContent)
	{
		if (Array.isArray(oContent))
		{
			if (oContent.length === 1)
				return oContent[0];

			return oContent;
		}

		return oContent;
	};
	function ConvertLaTeXToTokensList(str, oContext, isGetOnlyTokens)
	{
		if (undefined === str || null === str)
			return;

		const oConverter = new CLaTeXParser(true);
		const oTokens = oConverter.Parse(str);

		if (!isGetOnlyTokens)
			ConvertTokens(oTokens, oContext);
		else
			return oTokens;

		return true;
	};

	//---------------------------------------export----------------------------------------------------
	window["AscMath"] = window["AscMath"] || {};
	window["AscMath"].ConvertLaTeXToTokensList = ConvertLaTeXToTokensList;
})(window);
