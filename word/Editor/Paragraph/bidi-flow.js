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

(function(window)
{
	const BidiType = {
		ltr : 0, // strong rtl
		rtl : 1, // strong ltr
		weak : 2,
		neutral : 3
	};
	
	/**
	 * Class for handling bidirectional flow of text or other content
	 * @param handler - handler for elements in the flow
	 * @constructor
	 */
	function BidiFlow(handler)
	{
		this.handler   = handler;
		this.buffer    = [];
		this.direction = null;
		
		
		this.neutralBuffer = [];
	}
	/**
	 * @param direction - main flow direction
	 */
	BidiFlow.prototype.begin = function(direction)
	{
		this.direction            = direction;
		this.buffer.length        = 0;
		this.neutralBuffer.length = 0;
	};
	BidiFlow.prototype.add = function(element, bidiType)
	{
		if (AscWord.BidiType.rtl === this.direction)
		{
		
		}
		else
		{
			if (bidiType & AscBidi.FLAG.STRONG && bidiType & AscBidi.FLAG.RTL)
			{
				this.flushNeutralRTL();
				this.buffer.push(element);
			}
			else if (bidiType & AscBidi.FLAG.STRONG || 0 === this.buffer.length)
			{
				this.flush();
				this.handler.handleBidiFlow(element, AscWord.BidiType.ltr);
			}
			else
			{
				this.neutralBuffer.push([bidiType, element]);
			}
		}
	};
	BidiFlow.prototype.end = function()
	{
		this.flush();
	};
	////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	// Private area
	////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
	BidiFlow.prototype.flush = function()
	{
		for (let i = this.buffer.length - 1; i >= 0; --i)
		{
			this.handler.handleBidiFlow(this.buffer[i], AscWord.BidiType.rtl);
		}
		this.buffer.length = 0;
		
		for (let i = 0; i < this.neutralBuffer.length; ++i)
		{
			this.handler.handleBidiFlow(this.neutralBuffer[i][1], AscWord.BidiType.ltr);
		}
		this.neutralBuffer.length = 0;
	};
	BidiFlow.prototype.flushNeutralRTL = function()
	{
		let weakBuffer = [];
		
		function flushWeak(buffer)
		{
			for (let i = weakBuffer.length - 1; i >= 0; --i)
			{
				buffer.push(weakBuffer[i]);
			}
			
			weakBuffer.length = 0;
		}
		
		for (let i = 0; i < this.neutralBuffer.length; ++i)
		{
			let type = this.neutralBuffer[i][0];
			if (AscBidi.FLAG.NEUTRAL & type)
			{
				flushWeak(this.buffer);
				this.buffer.push(this.neutralBuffer[i][1]);
			}
			else
			{
				weakBuffer.push(this.neutralBuffer[i][1]);
			}
		}
		flushWeak(this.buffer);
		this.neutralBuffer.length = 0;
	};
	//--------------------------------------------------------export----------------------------------------------------
	AscWord.BidiFlow = BidiFlow;
	AscWord.BidiType = BidiType;
	
})(window);


